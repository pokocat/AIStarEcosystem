package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.model.DramaBrainstorm;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaBrainstormRepository;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.TransientDataAccessResourceException;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 聊天页「去制作 · 单条短视频」的扣费幂等（真 DramaShortService，只把两张表和账本换成内存 / mock）。
 *
 * 要钉死的事故：promote 只靠「脑暴已标 promoted 就原样返回」防重，而标记发生在建草稿、扣完开拍费之后。
 * 两次请求都在标记之前到达（双击、网络重发，或者建完草稿但标记那一步失败、用户再点一次），
 * 就会建两条草稿、扣两笔钱。现在前端一次确认发一把 clientRequestId，失败重试沿用；
 * 服务端把它交给 createFromRecipe 的 (owner, clientRequestId) 唯一键。
 */
class DramaBrainstormPromoteIdempotencyTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String USER = "u_promote";

    private Map<String, DramaBrainstorm> brainstorms;
    private Map<String, DramaShort> shorts;
    private CreditService creditService;
    private DramaBrainstormService svc;
    /** 打开后，下一次把脑暴写成 promoted 的 save 会失败一次（模拟「草稿建好了、标记没落库」）。 */
    private final AtomicBoolean failNextPromotedMark = new AtomicBoolean(false);

    @BeforeEach
    void setUp() {
        brainstorms = new HashMap<>();
        DramaBrainstormRepository brsRepo = mock(DramaBrainstormRepository.class);
        when(brsRepo.save(any())).thenAnswer(inv -> {
            DramaBrainstorm b = inv.getArgument(0);
            if ("promoted".equals(b.getStatus()) && failNextPromotedMark.getAndSet(false)) {
                // 真实库里这次写入没成功：把内存里的行也退回草稿态（JPA 实体是同一个对象）。
                b.setStatus("draft");
                b.setPromotedKind(null);
                b.setPromotedId(null);
                throw new TransientDataAccessResourceException("db blip while marking promoted");
            }
            brainstorms.put(b.getId(), b);
            return b;
        });
        when(brsRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaBrainstorm b = brainstorms.get(inv.<String>getArgument(0));
            if (b == null || b.getDeletedAt() != null
                    || !Objects.equals(b.getOwnerUserId(), inv.getArgument(1))) return Optional.empty();
            return Optional.of(b);
        });

        shorts = new HashMap<>();
        DramaShortRepository shortRepo = mock(DramaShortRepository.class);
        when(shortRepo.save(any())).thenAnswer(inv -> {
            DramaShort s = inv.getArgument(0);
            // 模拟唯一索引 uk_drama_short_owner_client_req。
            if (s.getClientRequestId() != null && !shorts.containsKey(s.getId())) {
                boolean taken = shorts.values().stream().anyMatch(o ->
                        o.getOwnerUserId().equals(s.getOwnerUserId())
                                && s.getClientRequestId().equals(o.getClientRequestId()));
                if (taken) throw new DataIntegrityViolationException("uk_drama_short_owner_client_req");
            }
            shorts.put(s.getId(), s);
            return s;
        });
        when(shortRepo.findFirstByOwnerUserIdAndClientRequestId(anyString(), anyString())).thenAnswer(inv ->
                shorts.values().stream()
                        .filter(s -> inv.getArgument(0, String.class).equals(s.getOwnerUserId())
                                && inv.getArgument(1, String.class).equals(s.getClientRequestId()))
                        .findFirst());

        creditService = mock(CreditService.class);
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1, Long.class));
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);

        DramaShortService shortService = new DramaShortService(shortRepo, OM, creditService, configs,
                CdnUrlSigner.NOOP, new DramaShortContinuityService(OM));
        svc = new DramaBrainstormService(brsRepo, OM, mock(AiModelInvocationService.class),
                mock(PromptService.class), mock(DramaProjectService.class), shortService);
    }

    private String brainstormWithOutline() throws Exception {
        String id = svc.createBrainstorm(null, USER).path("meta").path("id").asText();
        svc.saveBrainstorm(id, OM.readTree("""
                {"data":{"messages":[{"role":"user","text":"熬夜党的面膜"}],
                 "outline":{"title":"熬夜面膜种草","type":"口播种草","logline":"熬夜三天，脸还能救回来",
                            "mainline":"先摆出熬夜后的脸，再上面膜，第二天对比","beats":[],"roles":[],"scenes":[]},
                 "settings":{"form":"single","ratio":"9:16"}}}
                """), USER);
        return id;
    }

    private JsonNode promoteBody(String key) {
        var body = OM.createObjectNode().put("form", "single");
        if (key != null) body.put("clientRequestId", key);
        return body;
    }

    @Test
    void sameKeyRetryAfterFailedMarkReturnsSameDraftAndChargesOnce() throws Exception {
        String id = brainstormWithOutline();

        // 第一次：草稿建好、开拍费扣了，但标记 promoted 失败 → 请求报错，用户看到失败。
        failNextPromotedMark.set(true);
        assertThrows(TransientDataAccessResourceException.class,
                () -> svc.promote(id, promoteBody("confirm-7f3a"), USER));
        assertEquals(1, shorts.size());
        assertEquals("draft", brainstorms.get(id).getStatus(), "标记没落库，脑暴仍是草稿态 —— 老的防重挡不住下一次");

        // 同一次确认的重试（同一把键）：拿回同一条草稿，不再冻结、不再扣费。
        JsonNode retry = svc.promote(id, promoteBody("confirm-7f3a"), USER);

        String firstShortId = shorts.keySet().iterator().next();
        assertEquals(firstShortId, retry.path("shortId").asText());
        assertEquals(1, shorts.size(), "不能再建第二条草稿");
        verify(creditService, times(1)).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService, times(1)).commitHold(eq("DRAMA_SHORT"), anyString(), eq(10L), anyString());
        assertEquals("promoted", brainstorms.get(id).getStatus());
        assertEquals(firstShortId, brainstorms.get(id).getPromotedId());
    }

    @Test
    void sameKeyRaceWhereSecondRequestMissesThePromotedMarkStillChargesOnce() throws Exception {
        String id = brainstormWithOutline();
        JsonNode first = svc.promote(id, promoteBody("confirm-race"), USER);

        // 第二个请求在第一个标记 promoted 之前就读到了脑暴（并发双击）：把行退回草稿态重放这个时序。
        DramaBrainstorm row = brainstorms.get(id);
        row.setStatus("draft");
        row.setPromotedKind(null);
        row.setPromotedId(null);
        JsonNode second = svc.promote(id, promoteBody("confirm-race"), USER);

        assertEquals(first.path("shortId").asText(), second.path("shortId").asText());
        assertEquals(1, shorts.size());
        verify(creditService, times(1)).hold(eq(USER), anyLong(), eq("DRAMA_SHORT"), anyString(), anyString());
    }

    @Test
    void replayedPromoteFromAnOldTabDoesNotOverwriteTheSealedConversation() throws Exception {
        String id = brainstormWithOutline();
        String shortId = svc.promote(id, promoteBody("confirm-seal"), USER).path("shortId").asText();
        String sealed = brainstorms.get(id).getPayloadJson();

        // 旧标签页 / 重放的请求：带着一份旧对话、旧大纲再点一次「去制作」。
        var stale = (com.fasterxml.jackson.databind.node.ObjectNode) promoteBody("confirm-seal");
        stale.set("data", OM.readTree("""
                {"messages":[{"role":"user","text":"旧标签页里的另一段话"}],
                 "outline":{"title":"旧大纲","beats":["a"],"roles":[],"scenes":[]},
                 "settings":{"form":"series","ratio":"16:9"}}
                """));
        JsonNode again = svc.promote(id, stale, USER);

        assertEquals(shortId, again.path("shortId").asText(), "还是回到原来那条");
        assertEquals(sealed, brainstorms.get(id).getPayloadJson(), "已去制作的对话、大纲、设置不能被整份换掉");
        assertEquals(1, shorts.size());
        verify(creditService, times(1)).hold(eq(USER), anyLong(), eq("DRAMA_SHORT"), anyString(), anyString());
    }

    @Test
    void autosaveAfterPromoteIsRejectedInsteadOfOverwritingOrPretendingToSave() throws Exception {
        String id = brainstormWithOutline();
        svc.promote(id, promoteBody("confirm-ro"), USER);
        String sealed = brainstorms.get(id).getPayloadJson();

        var e = assertThrows(com.aistareco.common.BusinessException.class, () -> svc.saveBrainstorm(id,
                OM.readTree("{\"data\":{\"messages\":[{\"role\":\"user\",\"text\":\"返回键回来又聊了两句\"}]}}"), USER));

        assertEquals("DRAMA_BRAINSTORM_ALREADY_PROMOTED", e.getCode());
        assertEquals(409, e.getStatus().value());
        assertEquals(sealed, brainstorms.get(id).getPayloadJson());
    }

    @Test
    void promotedDraftCarriesTheStoryAsIdeaSoTheMakePageWritesRightAway() throws Exception {
        String id = brainstormWithOutline();
        String shortId = svc.promote(id, promoteBody("confirm-idea"), USER).path("shortId").asText();

        JsonNode data = OM.readTree(shorts.get(shortId).getPayloadJson());
        // 制作页：data.idea 非空且没有分镜 → 自动写口播脚本；没有 styleRef → 不会变成「照【故事名】的风格来做」。
        assertTrue(data.path("idea").isTextual(), data.toString());
        assertTrue(data.path("idea").asText().contains("熬夜三天，脸还能救回来"));
        assertTrue(data.path("idea").asText().contains("第二天对比"));
        assertTrue(data.path("styleName").isMissingNode(), data.toString());
        assertTrue(data.path("styleRef").isMissingNode(), data.toString());
        assertEquals("熬夜面膜种草", data.path("title").asText());
        assertEquals("口播种草", data.path("fmtName").asText());
        assertEquals(0, data.path("shots").size());
    }
}
