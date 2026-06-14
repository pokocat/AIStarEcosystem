package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * DramaShortService（v0.76 短视频草稿）：可恢复草稿 CRUD
 * —— 新建 seed / 整页保存回算 / 归属隔离 / 软删 / 完成态。
 */
class DramaShortServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final String USER = "u_owner";

    private Map<String, DramaShort> db;
    private DramaShortRepository repo;
    private CreditService creditService;
    private PlatformConfigService configs;
    private DramaShortService svc;

    @BeforeEach
    void setUp() {
        db = new HashMap<>();
        repo = mock(DramaShortRepository.class);
        when(repo.save(any())).thenAnswer(inv -> {
            DramaShort s = inv.getArgument(0);
            db.put(s.getId(), s);
            return s;
        });
        when(repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(anyString(), anyString())).thenAnswer(inv -> {
            DramaShort s = db.get(inv.getArgument(0, String.class));
            boolean ok = s != null && inv.getArgument(1, String.class).equals(s.getOwnerUserId()) && s.getDeletedAt() == null;
            return Optional.ofNullable(ok ? s : null);
        });
        when(repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(anyString())).thenAnswer(inv ->
                db.values().stream()
                        .filter(s -> inv.getArgument(0, String.class).equals(s.getOwnerUserId()) && s.getDeletedAt() == null)
                        .toList());
        creditService = mock(CreditService.class);
        configs = mock(PlatformConfigService.class);
        // 默认回落传入的默认值（短视频开拍默认 10）；具体扣费用例再按 key 覆盖。
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1, Long.class));
        svc = new DramaShortService(repo, OM, creditService, configs);
    }

    @Test
    void createSeedsMinimalDraft() {
        JsonNode detail = svc.createShort(
                OM.createObjectNode().put("fmtKey", "sell").put("fmtName", "口播带货").put("idea", "熬夜精华别错过"),
                USER);
        JsonNode meta = detail.get("meta");
        JsonNode data = detail.get("data");
        assertTrue(meta.get("id").asText().startsWith("dvs_"));
        assertEquals("熬夜精华别错过", meta.get("title").asText());
        assertEquals("sell", meta.get("fmtKey").asText());
        assertEquals("draft", meta.get("status").asText());
        assertEquals(0, meta.get("shotCount").asInt());
        // seed payload 合法且各数组为空
        assertEquals("script", data.get("step").asText());
        assertTrue(data.get("meta").isNull());
        assertTrue(data.get("shots").isArray() && data.get("shots").isEmpty());
        assertEquals("熬夜精华别错过", data.get("idea").asText());
    }

    @Test
    void saveRecomputesCardFieldsFromShots() {
        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER).get("meta").get("id").asText();

        // 整页保存：2 镜（1 已成片），meta.title 覆盖标题
        String payload = "{\"step\":\"factory\",\"fmtKey\":\"sell\",\"fmtName\":\"口播带货\","
                + "\"meta\":{\"title\":\"熬夜精华·转化版\",\"style\":[\"高级感\"],\"scene\":\"咖啡馆\",\"character\":{\"name\":\"主播\",\"description\":\"\"}},"
                + "\"shots\":[{\"id\":\"sh1\",\"dur\":9,\"flow\":\"done\",\"visual\":\"产品特写\",\"frameUrl\":\"https://cdn.example.com/f1.jpg\",\"videoUrl\":\"https://cdn.example.com/v1.mp4\"},"
                + "{\"id\":\"sh2\",\"dur\":6,\"flow\":\"frame\",\"visual\":\"对比\",\"frameUrls\":[\"https://cdn.example.com/f2.jpg\"]}],"
                + "\"chat\":[],\"refs\":[]}";
        var body = OM.createObjectNode();
        body.set("data", readTree(payload));
        JsonNode saved = svc.saveShort(id, body, USER);
        JsonNode meta = saved.get("meta");
        assertEquals("熬夜精华·转化版", meta.get("title").asText());   // 取 meta.title
        assertEquals(15, meta.get("durationSec").asInt());            // 9 + 6
        assertEquals(2, meta.get("shotCount").asInt());
        assertEquals(1, meta.get("doneCount").asInt());
        assertEquals(50, meta.get("progress").asInt());              // 1/2
        assertEquals("https://cdn.example.com/f1.jpg", meta.get("coverUrl").asText());
        assertEquals("https://cdn.example.com/v1.mp4", meta.get("videoUrl").asText());

        // 列表能取回，且整页 data 原样回读
        List<JsonNode> list = svc.listShorts(USER);
        assertEquals(1, list.size());
        assertEquals("https://cdn.example.com/v1.mp4", list.get(0).get("videoUrl").asText());
        JsonNode reloaded = svc.getShort(id, USER).get("data");
        assertEquals(2, reloaded.get("shots").size());
        assertEquals("factory", reloaded.get("step").asText());
    }

    @Test
    void markDoneSetsStatus() {
        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER).get("meta").get("id").asText();
        var body = OM.createObjectNode();
        body.set("data", readTree("{\"step\":\"factory\",\"shots\":[{\"id\":\"s1\",\"dur\":5,\"flow\":\"done\"}],\"chat\":[],\"refs\":[]}"));
        body.put("status", "done");
        JsonNode saved = svc.saveShort(id, body, USER);
        assertEquals("done", saved.get("meta").get("status").asText());
        assertEquals(100, saved.get("meta").get("progress").asInt());
    }

    @Test
    void ownershipIsolationAndSoftDelete() {
        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER).get("meta").get("id").asText();
        // 他人不可见 / 不可取
        assertTrue(svc.listShorts("u_other").isEmpty());
        assertThrows(BusinessException.class, () -> svc.getShort(id, "u_other"));
        // 软删后本人也列不到
        svc.deleteShort(id, USER);
        assertTrue(svc.listShorts(USER).isEmpty());
        assertThrows(BusinessException.class, () -> svc.getShort(id, USER));
    }

    @Test
    void createChargesEntryThroughHoldThenCommit() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER);
        // 进工作台开拍 = hold → 建草稿 → commit（一次，且不释放）。
        verify(creditService).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService).commitHold(eq("DRAMA_SHORT"), anyString(), eq(10L), anyString());
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void createFromRecipeChargesEntryOnce() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(8L);
        String id = svc.createFromRecipe(USER, "韦斯·安德森风格", "风格短片", "#0ea5e9", "#22c55e", "韦斯·安德森风格", "对称构图 · 复古色卡");
        assertTrue(id.startsWith("dvs_"));
        verify(creditService).hold(eq(USER), eq(8L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService).commitHold(eq("DRAMA_SHORT"), anyString(), eq(8L), anyString());
    }

    @Test
    void zeroPriceSkipsCharge() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(0L);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER);
        verify(creditService, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void chargeFailureReleasesHoldAndDoesNotPersist() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        // 建草稿过程中失败（repo.save 抛错）→ release，不 commit。
        // 用 doThrow 形式避免触发 setUp 里 save 的 thenAnswer（否则 stub 阶段传 null 会 NPE）。
        doThrow(new RuntimeException("db down")).when(repo).save(any());
        assertThrows(RuntimeException.class,
                () -> svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER));
        verify(creditService).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService).releaseHold(eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
    }

    private static JsonNode readTree(String s) {
        try {
            return OM.readTree(s);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
