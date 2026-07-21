package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaCharacter;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaScene;
import com.aistareco.aep.repository.DramaCharacterRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaSceneRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaReferenceAssetService（C-2）：
 *   - 懒回填幂等（跑两次不重复建）
 *   - 双写 upsert 对齐（增 / 改名 / 软删）
 *   - 单图 refCdnKey → refImages[0] 迁移
 *   - 三视图 hold 总额 / 逐角度 commit / 部分失败 release / 全失败 release 全额 + 抛错 / 未配端点 503 且 0 hold
 * 用内存 Map 背书 repo（避免 JPA 上下文），ObjectMapper 用真实实例，signer 用 NOOP。
 */
@TestPropertySource(properties = "aep.cdn.driver=local")
class DramaReferenceAssetServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String USER = "u1";
    private static final String PID = "dp_1";

    private Map<String, DramaCharacter> charStore;
    private Map<String, DramaScene> sceneStore;
    private Map<String, DramaProject> projStore;
    private DramaCharacterRepository charRepo;
    private DramaSceneRepository sceneRepo;
    private DramaProjectRepository projectRepo;
    private DramaRenderService render;
    private CreditService credit;
    private DramaReferenceAssetService svc;

    @BeforeEach
    void setup() {
        charStore = new HashMap<>();
        sceneStore = new HashMap<>();
        projStore = new HashMap<>();
        charRepo = mock(DramaCharacterRepository.class);
        sceneRepo = mock(DramaSceneRepository.class);
        projectRepo = mock(DramaProjectRepository.class);
        render = mock(DramaRenderService.class);
        credit = mock(CreditService.class);
        PlatformConfigService configs = mock(PlatformConfigService.class);
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.<Long>getArgument(1));

        // ── 内存 charRepo ──
        when(charRepo.save(any())).thenAnswer(inv -> {
            DramaCharacter c = inv.getArgument(0);
            charStore.put(c.getId(), c);
            return c;
        });
        when(charRepo.existsByProjectId(anyString())).thenAnswer(inv ->
                charStore.values().stream().anyMatch(c -> Objects.equals(c.getProjectId(), inv.getArgument(0))));
        when(charRepo.findByProjectId(anyString())).thenAnswer(inv -> {
            List<DramaCharacter> out = new ArrayList<>();
            for (DramaCharacter c : charStore.values())
                if (Objects.equals(c.getProjectId(), inv.getArgument(0))) out.add(c);
            return out;
        });
        when(charRepo.findByProjectIdAndDeletedAtIsNull(anyString())).thenAnswer(inv -> {
            List<DramaCharacter> out = new ArrayList<>();
            for (DramaCharacter c : charStore.values())
                if (Objects.equals(c.getProjectId(), inv.getArgument(0)) && c.getDeletedAt() == null) out.add(c);
            return out;
        });
        when(charRepo.findByIdAndProjectIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaCharacter c = charStore.get(inv.<String>getArgument(0));
            if (c == null || c.getDeletedAt() != null || !Objects.equals(c.getProjectId(), inv.getArgument(1)))
                return Optional.empty();
            return Optional.of(c);
        });

        // ── 内存 sceneRepo ──
        when(sceneRepo.save(any())).thenAnswer(inv -> {
            DramaScene s = inv.getArgument(0);
            sceneStore.put(s.getId(), s);
            return s;
        });
        when(sceneRepo.existsByProjectId(anyString())).thenAnswer(inv ->
                sceneStore.values().stream().anyMatch(s -> Objects.equals(s.getProjectId(), inv.getArgument(0))));
        when(sceneRepo.findByProjectId(anyString())).thenAnswer(inv -> {
            List<DramaScene> out = new ArrayList<>();
            for (DramaScene s : sceneStore.values())
                if (Objects.equals(s.getProjectId(), inv.getArgument(0))) out.add(s);
            return out;
        });
        when(sceneRepo.findByProjectIdAndDeletedAtIsNull(anyString())).thenAnswer(inv -> {
            List<DramaScene> out = new ArrayList<>();
            for (DramaScene s : sceneStore.values())
                if (Objects.equals(s.getProjectId(), inv.getArgument(0)) && s.getDeletedAt() == null) out.add(s);
            return out;
        });

        when(projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaProject p = projStore.get(inv.<String>getArgument(0));
            if (p == null || !Objects.equals(p.getOwnerUserId(), inv.getArgument(1))) return Optional.empty();
            return Optional.of(p);
        });

        svc = new DramaReferenceAssetService(projectRepo, charRepo, sceneRepo, render, credit, configs,
                CdnUrlSigner.NOOP, OM);
    }

    private JsonNode json(String s) {
        try { return OM.readTree(s); } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void seedProject(String payloadJson) {
        DramaProject p = DramaProject.builder().id(PID).ownerUserId(USER)
                .title("测试").payloadJson(payloadJson).build();
        projStore.put(PID, p);
    }

    // ── 懒回填幂等 ──────────────────────────────────────────────────────────────

    @Test
    void backfill_isIdempotent() {
        JsonNode data = json("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"},"
                + "{\"id\":\"ch_2\",\"name\":\"路人\",\"role\":\"extra\"}],"
                + "\"scenes\":[{\"id\":\"scn_1\",\"name\":\"办公室\",\"mood\":\"冷白\"}]}");
        svc.ensureBackfilled(PID, USER, data);
        assertEquals(2, charStore.size());
        assertEquals(1, sceneStore.size());
        // 再跑一次：幂等闸命中（existsByProjectId），不重复建。
        svc.ensureBackfilled(PID, USER, data);
        assertEquals(2, charStore.size());
        assertEquals(1, sceneStore.size());
    }

    @Test
    void backfill_singleRefCdnKey_migratesToRefImagesFront() {
        JsonNode data = json("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\",\"refCdnKey\":\"drama/frames/x.png\"}]}");
        svc.ensureBackfilled(PID, USER, data);
        DramaCharacter c = charStore.get("ch_1");
        assertNotNull(c.getRefImagesJson());
        JsonNode refs = json(c.getRefImagesJson());
        assertEquals(1, refs.size());
        assertEquals("drama/frames/x.png", refs.get(0).path("cdnKey").asText());
        assertEquals("front", refs.get(0).path("angle").asText());
    }

    // ── 双写 upsert 对齐 ────────────────────────────────────────────────────────

    @Test
    void syncFromDoc_add_rename_softDelete() {
        // 初始：A、B 两角色
        svc.syncFromDoc(PID, USER, json("{\"characters\":[{\"id\":\"A\",\"name\":\"甲\",\"role\":\"key\"},"
                + "{\"id\":\"B\",\"name\":\"乙\",\"role\":\"extra\"}]}"));
        assertEquals(2, charStore.size());
        assertEquals("甲", charStore.get("A").getName());
        assertNull(charStore.get("A").getDeletedAt());

        // 改名 A + 删 B（文档只剩 A）
        svc.syncFromDoc(PID, USER, json("{\"characters\":[{\"id\":\"A\",\"name\":\"甲改\",\"role\":\"key\"}]}"));
        assertEquals("甲改", charStore.get("A").getName());
        assertNull(charStore.get("A").getDeletedAt());
        assertNotNull(charStore.get("B").getDeletedAt(), "文档缺失的角色应软删对齐");
    }

    @Test
    void syncFromDoc_preservesEntityRefImages_whenDocOmitsThem() {
        // 实体已有三视图产物（refImages），前端老 PUT 不带 refImages → 不能被抹掉。
        svc.syncFromDoc(PID, USER, json("{\"characters\":[{\"id\":\"A\",\"name\":\"甲\",\"role\":\"key\","
                + "\"refImages\":[{\"cdnKey\":\"k1\",\"angle\":\"front\"}]}]}"));
        assertEquals(1, json(charStore.get("A").getRefImagesJson()).size());
        // 再 PUT 不带 refImages → 保留原有
        svc.syncFromDoc(PID, USER, json("{\"characters\":[{\"id\":\"A\",\"name\":\"甲\",\"role\":\"key\"}]}"));
        assertNotNull(charStore.get("A").getRefImagesJson());
        assertEquals(1, json(charStore.get("A").getRefImagesJson()).size());
    }

    // ── 三视图 hold→commit ──────────────────────────────────────────────────────

    @Test
    void referenceSheet_holdTotal_commitPerAngle() {
        seedProject("{\"projectInfo\":{\"ratio\":\"9:16\"},\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenReturn("drama/char-refs/a.png", "drama/char-refs/b.png", "drama/char-refs/c.png");

        JsonNode out = svc.generateReferenceSheet(PID, "ch_1", null, USER);

        // frameCost 默认 2 × 3 角度 = hold 6
        verify(credit).hold(eq(USER), eq(6L), eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        // 逐角度 commit 各 2
        verify(credit, times(3)).commitHold(eq("DRAMA_CHAR_SHEET"), anyString(), eq(2L), anyString());
        // 全成功不 release
        verify(credit, never()).releaseHold(anyString(), anyString(), anyString());
        assertEquals(6L, out.path("cost").asLong());
        assertEquals(3, out.path("refImages").size());
        assertEquals("front", out.path("refImages").get(0).path("angle").asText());
        // 落实体表
        assertEquals(3, json(charStore.get("ch_1").getRefImagesJson()).size());
    }

    @Test
    void referenceSheet_regenerate_replacesStaleAngleEntry_notAppend() {
        // 回归测试：「重新生成」某一角度此前会无条件 addObject() 追加到数组末尾，旧图仍留在数组前部。
        // frontRefUrl/firstRefUrl（DramaReferenceAssembler）按插入顺序取首个匹配角度，永远命中旧图——
        // 用户重新生成 front 角度、被扣费，但参考装配实际仍用旧图，新图完全没有生效。
        String payload = "{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}";
        seedProject(payload);
        svc.ensureBackfilled(PID, USER, json(payload));
        DramaCharacter ch = charStore.get("ch_1");
        assertNotNull(ch, "ensureBackfilled 应已建好角色实体");
        ch.setRefImagesJson("[{\"cdnKey\":\"drama/char-refs/old-front.png\",\"angle\":\"front\",\"label\":\"正面\"}]");
        charStore.put("ch_1", ch);

        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenReturn("drama/char-refs/new-front.png");

        JsonNode out = svc.generateReferenceSheet(PID, "ch_1",
                json("{\"angles\":[\"front\"]}"), USER);

        assertEquals(1, out.path("refImages").size(), "重新生成同一角度应替换旧图，而非追加成 2 条");
        assertEquals("drama/char-refs/new-front.png", out.path("refImages").get(0).path("cdnKey").asText());
        JsonNode stored = json(charStore.get("ch_1").getRefImagesJson());
        assertEquals(1, stored.size());
        assertEquals("drama/char-refs/new-front.png", stored.get(0).path("cdnKey").asText());
    }

    @Test
    void referenceSheet_partialFailure_releasesRemaining() {
        seedProject("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenReturn("drama/char-refs/a.png")
                .thenThrow(new BusinessException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "IMAGE_CALL_FAILED", "boom"));

        JsonNode out = svc.generateReferenceSheet(PID, "ch_1", null, USER);

        verify(credit).hold(eq(USER), eq(6L), eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        verify(credit, times(1)).commitHold(eq("DRAMA_CHAR_SHEET"), anyString(), eq(2L), anyString());
        verify(credit, times(1)).releaseHold(eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        assertEquals(2L, out.path("cost").asLong());
        assertEquals(1, out.path("refImages").size());
    }

    @Test
    void referenceSheet_allFail_releasesFull_throws() {
        seedProject("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenThrow(new BusinessException(org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "IMAGE_CALL_FAILED", "boom"));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.generateReferenceSheet(PID, "ch_1", null, USER));
        assertEquals(org.springframework.http.HttpStatus.BAD_GATEWAY, ex.getStatus());
        verify(credit).hold(eq(USER), eq(6L), eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        verify(credit, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credit, times(1)).releaseHold(eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
    }

    @Test
    void referenceSheet_commitHoldThrowsResponseStatusException_stillReleasesFull() {
        // 回归测试（追踪 7eb7e53 的修复）：CreditService.commitHold 实际抛的是
        // ResponseStatusException（非 BusinessException 子类）。此前 catch 块只捕 BusinessException，
        // 会让 commitHold 失败跳过下面的 releaseHold，冻结的 pendingBalance 只能等
        // CreditHoldSweeper 兜底（默认 180 分钟才释放）。这里直接 mock commitHold（而非
        // renderCharacterReferenceFrame）抛 ResponseStatusException，验证 catch(RuntimeException)
        // 能捕住它、releaseHold 仍被调用、且异常原样向上抛出（不被吞掉/掩盖成别的错误码）。
        seedProject("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenReturn("drama/char-refs/a.png", "drama/char-refs/b.png", "drama/char-refs/c.png");
        doThrow(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "wallet commit failed"))
                .when(credit).commitHold(eq("DRAMA_CHAR_SHEET"), anyString(), eq(2L), anyString());

        org.springframework.web.server.ResponseStatusException ex = assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> svc.generateReferenceSheet(PID, "ch_1", null, USER));
        assertEquals(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, ex.getStatusCode());

        verify(credit).hold(eq(USER), eq(6L), eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        // 首个角度 commit 即抛错，停在第一次尝试（不会继续后续角度）
        verify(credit, times(1)).commitHold(eq("DRAMA_CHAR_SHEET"), anyString(), eq(2L), anyString());
        // 关键断言：catch(RuntimeException) 生效，全额冻结被立刻 release，不必等 sweeper 兜底
        verify(credit, times(1)).releaseHold(eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
    }

    @Test
    void referenceSheet_commitHoldFailsOnLaterAngle_doesNotPersistUnpaidImage() {
        // 回归测试：此前 refImages.addObject() 发生在 commitHold 之前——若某个非首个角度的
        // render 成功但 commitHold 随后失败（比如钱包并发/瞬时错误），失败角度对应的「未付费」
        // 图仍会残留在数组里被落库（连同其 removeExistingAngle 顶替掉的旧图一起），而 release
        // 又把这笔钱退了回去：用户白得一张图、账本上却没有对应的真实扣费。
        // 场景：front 角度 render+commit 都成功；side 角度 render 成功但 commitHold 抛错——
        // 断言最终持久化 / 返回的 refImages 只含 front 这一张已付费的图，不含 side。
        seedProject("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        when(render.renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList()))
                .thenReturn("drama/char-refs/front.png", "drama/char-refs/side.png", "drama/char-refs/full.png");
        com.aistareco.aep.dto.LedgerEntryDto dummyCommit = new com.aistareco.aep.dto.LedgerEntryDto(
                "le_1", "w_1", USER, null, null, null, "spend", -2L, 0L, "front", "cs_x", "DRAMA_CHAR_SHEET",
                java.time.Instant.now());
        when(credit.commitHold(eq("DRAMA_CHAR_SHEET"), anyString(), eq(2L), anyString()))
                .thenReturn(dummyCommit)
                .thenThrow(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "wallet commit failed"));

        JsonNode out = svc.generateReferenceSheet(PID, "ch_1", null, USER);

        // 只有 front 真正 commit 成功；side 失败即 break，full 从未尝试。
        assertEquals(2L, out.path("cost").asLong());
        assertEquals(1, out.path("refImages").size(), "commitHold 失败的角度不应出现在返回的 refImages 里");
        assertEquals("front", out.path("refImages").get(0).path("angle").asText());
        verify(credit, times(1)).releaseHold(eq("DRAMA_CHAR_SHEET"), anyString(), anyString());
        // 落实体表也只应有已付费的这一张，不能把失败角度的图一起持久化下来。
        JsonNode stored = json(charStore.get("ch_1").getRefImagesJson());
        assertEquals(1, stored.size(), "落库的 refImages 不应包含未提交扣费的角度");
        assertEquals("front", stored.get(0).path("angle").asText());
    }

    @Test
    void referenceSheet_endpointNotConfigured_no_hold() {
        seedProject("{\"characters\":[{\"id\":\"ch_1\",\"name\":\"林萧\",\"role\":\"key\"}]}");
        doThrow(new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "IMAGE_NOT_CONFIGURED", "未配"))
                .when(render).preflightCharacterReferenceSheet(anyString());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> svc.generateReferenceSheet(PID, "ch_1", null, USER));
        assertEquals("IMAGE_NOT_CONFIGURED", ex.getCode());
        // §8.0：未配端点 → 不 hold、不扣费、不出图
        verify(credit, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(render, never()).renderCharacterReferenceFrame(anyString(), anyMap(), anyString(), anyList());
    }
}
