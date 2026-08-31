package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.nio.file.Path;
import java.time.Instant;
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
        when(repo.findByOwnerUserIdAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(anyString(), any()))
                .thenAnswer(inv -> db.values().stream()
                        .filter(s -> inv.getArgument(0, String.class).equals(s.getOwnerUserId())
                                && s.getDeletedAt() == null
                                && s.getCreatedAt() != null
                                && s.getCreatedAt().isAfter(inv.getArgument(1, java.time.OffsetDateTime.class)))
                        .toList());
        when(repo.findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(anyString())).thenAnswer(inv ->
                db.values().stream()
                        .filter(s -> inv.getArgument(0, String.class).equals(s.getOwnerUserId()) && s.getDeletedAt() != null)
                        .toList());
        when(repo.findByIdAndOwnerUserId(anyString(), anyString())).thenAnswer(inv -> {
            DramaShort s = db.get(inv.getArgument(0, String.class));
            boolean ok = s != null && inv.getArgument(1, String.class).equals(s.getOwnerUserId());
            return Optional.ofNullable(ok ? s : null);
        });
        doAnswer(inv -> { db.remove(inv.getArgument(0, DramaShort.class).getId()); return null; })
                .when(repo).delete(any());
        creditService = mock(CreditService.class);
        configs = mock(PlatformConfigService.class);
        // 默认回落传入的默认值（短视频开拍默认 10）；具体扣费用例再按 key 覆盖。
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.getArgument(1, Long.class));
        svc = new DramaShortService(repo, OM, creditService, configs, CdnUrlSigner.NOOP,
                new DramaShortContinuityService(OM));
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
    void clientCannotMarkDoneBeforeServerAssembly() {
        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER).get("meta").get("id").asText();
        var body = OM.createObjectNode();
        body.set("data", readTree("{\"step\":\"factory\",\"shots\":[{\"id\":\"s1\",\"no\":1,\"dur\":5,\"flow\":\"done\",\"videoUrl\":\"/cdn/v1.mp4\"}],\"chat\":[],\"refs\":[]}"));
        body.put("status", "done");
        BusinessException ex = assertThrows(BusinessException.class, () -> svc.saveShort(id, body, USER));
        assertEquals("DRAMA_SHORT_ASSEMBLY_REQUIRED", ex.getCode());
        assertEquals("draft", svc.getShort(id, USER).get("meta").get("status").asText());
    }

    @Test
    void listResignsPreviewMediaUrls() {
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.maybeSign("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/drama/frames/old.png"))
                .thenReturn("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/drama/frames/old.png?x-oss-signature=fresh");
        when(signer.maybeSign("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/material-videos/old.mp4"))
                .thenReturn("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/material-videos/old.mp4?x-oss-signature=fresh");
        svc = new DramaShortService(repo, OM, creditService, configs, signer,
                new DramaShortContinuityService(OM));

        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell"), USER).get("meta").get("id").asText();
        var body = OM.createObjectNode();
        body.set("data", readTree("{\"step\":\"factory\","
                + "\"shots\":[{\"id\":\"s1\",\"dur\":5,\"flow\":\"done\","
                + "\"frameUrl\":\"https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/drama/frames/old.png\","
                + "\"videoUrl\":\"https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/material-videos/old.mp4\"}],"
                + "\"chat\":[],\"refs\":[]}"));
        svc.saveShort(id, body, USER);

        JsonNode summary = svc.listShorts(USER).get(0);
        assertEquals("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/drama/frames/old.png?x-oss-signature=fresh",
                summary.get("coverUrl").asText());
        assertEquals("https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/material-videos/old.mp4?x-oss-signature=fresh",
                summary.get("videoUrl").asText());
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
    void trashLifecycle_listRestorePurge() {
        String id = svc.createShort(OM.createObjectNode().put("fmtKey", "sell").put("idea", "出差高铁邻座"), USER)
                .get("meta").get("id").asText();

        // 软删 → 进回收站（带 deletedAt / purgeAt / daysLeft），工坊列表里消失
        svc.deleteShort(id, USER);
        List<JsonNode> trash = svc.listTrash(USER);
        assertEquals(1, trash.size());
        JsonNode t = trash.get(0);
        assertEquals(id, t.get("id").asText());
        assertFalse(t.get("deletedAt").isNull());
        assertFalse(t.get("purgeAt").isNull());
        assertTrue(t.get("daysLeft").asLong() >= 29 && t.get("daysLeft").asLong() <= 30);
        assertTrue(svc.listShorts(USER).isEmpty());
        // 他人看不到我的回收站
        assertTrue(svc.listTrash("u_other").isEmpty());

        // 恢复 → 回到工坊列表，回收站清空
        svc.restoreShort(id, USER);
        assertEquals(1, svc.listShorts(USER).size());
        assertTrue(svc.listTrash(USER).isEmpty());

        // 未在回收站直接彻底删除 → 报错（必须先软删）
        assertThrows(BusinessException.class, () -> svc.purgeShort(id, USER));

        // 软删后彻底删除 → 物理消失，回收站与工坊都没有
        svc.deleteShort(id, USER);
        svc.purgeShort(id, USER);
        assertTrue(svc.listTrash(USER).isEmpty());
        assertThrows(BusinessException.class, () -> svc.getShort(id, USER));
    }

    @Test
    void purgeExpiredTrash_removesOnlyOlderThanRetention() {
        // 一条刚软删（保留期内）、一条软删 31 天前（已过期）
        db.put("dvs_fresh", DramaShort.builder().id("dvs_fresh").ownerUserId(USER)
                .deletedAt(java.time.OffsetDateTime.now().minusDays(1)).build());
        db.put("dvs_old", DramaShort.builder().id("dvs_old").ownerUserId(USER)
                .deletedAt(java.time.OffsetDateTime.now().minusDays(31)).build());
        when(repo.findByDeletedAtBefore(any())).thenAnswer(inv -> {
            java.time.OffsetDateTime cutoff = inv.getArgument(0);
            return db.values().stream()
                    .filter(s -> s.getDeletedAt() != null && s.getDeletedAt().isBefore(cutoff))
                    .toList();
        });
        int cleaned = svc.purgeExpiredTrash();
        assertEquals(1, cleaned);
        assertFalse(db.containsKey("dvs_old"));
        assertTrue(db.containsKey("dvs_fresh"));
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
    void createWithPromptSeedBuildsShotsAndChargesEntryOnce() throws Exception {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        JsonNode body = OM.readTree("""
                {"seed":{"title":"沙漠访谈","logline":"一场荒诞的复盘","style":["电影感","赛博古装"],
                  "universalPrompt":"暖金逆光，浮尘",
                  "characters":[{"name":"云曦","visual":"月白襦裙，鎏金步摇","performance":"温柔但犀利"},
                                {"name":"赛博猴王","visual":"金橙长发，银蓝机械头冠","performance":"吹牛时手舞足蹈"}],
                  "scenes":[{"name":"寺院访谈区","visual":"朱红立柱，午后斜阳"}],
                  "shots":[{"durationSec":4,"visual":"两人入座","voWho":"旁白","voText":"准备开始访谈。",
                            "castNames":["云曦","赛博猴王"],"sceneName":"寺院访谈区","timecode":"00:00-00:04"},
                           {"durationSec":6,"visual":"猴王举起乌金锤","castNames":["赛博猴王"]}],
                  "notes":["有一镜时长按画面复杂度估"],
                  "promptSource":{"raw":"【角色】云曦：月白襦裙…"}}}
                """);

        JsonNode detail = svc.createShort(body, USER);
        JsonNode meta = detail.get("meta");
        JsonNode data = detail.get("data");

        // 卡片字段立刻正确（提示词直出的草稿一建出来就带分镜）。
        assertEquals("沙漠访谈", meta.get("title").asText());
        assertEquals("电影感 · 赛博古装", meta.get("fmtName").asText());
        assertEquals(2, meta.get("shotCount").asInt());
        assertEquals(10, meta.get("durationSec").asInt());
        assertEquals("draft", meta.get("status").asText());

        // 视觉设定与来源提示词落库；一致性锚点由服务端按 visualBible 派生。
        assertEquals(2, data.path("visualBible").path("characters").size());
        assertEquals("暖金逆光，浮尘", data.path("visualBible").path("universal").asText());
        assertEquals("【角色】云曦：月白襦裙…", data.path("promptSource").path("raw").asText());
        assertEquals(1, data.path("promptNotes").size());
        assertEquals(2, data.path("continuityManifest").path("characters").size());
        assertEquals(2, data.path("continuityManifest").path("shots").path(0).path("castIds").size());
        assertEquals(1, data.path("continuityManifest").path("shots").path(1).path("castIds").size());
        assertEquals("draft", data.path("shots").path(0).path("flow").asText());

        // 与「一句话生成」同一笔开拍费，不因为带 seed 多扣。
        verify(creditService).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService).commitHold(eq("DRAMA_SHORT"), anyString(), eq(10L), anyString());
        verify(creditService, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void sameClientRequestIdReturnsTheFirstDraftAndChargesOnlyOnce() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        var body = OM.createObjectNode().put("fmtKey", "sell").put("idea", "熬夜精华")
                .put("clientRequestId", "req-abc-123");

        JsonNode first = svc.createShort(body.deepCopy(), USER);
        // 响应丢包后客户端原样重试：必须回到同一条草稿，且不再扣第二笔开拍费。
        JsonNode retry = svc.createShort(body.deepCopy(), USER);

        assertEquals(first.path("meta").path("id").asText(), retry.path("meta").path("id").asText());
        assertEquals(1, db.size(), "重试不应再建一条草稿");
        verify(creditService, times(1)).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
        verify(creditService, times(1)).commitHold(eq("DRAMA_SHORT"), anyString(), eq(10L), anyString());
    }

    @Test
    void differentClientRequestIdsCreateSeparateDrafts() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell").put("clientRequestId", "req-1"), USER);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell").put("clientRequestId", "req-2"), USER);
        assertEquals(2, db.size());
        verify(creditService, times(2)).hold(eq(USER), eq(10L), eq("DRAMA_SHORT"), anyString(), anyString());
    }

    @Test
    void idempotencyKeyIsScopedToOwner() {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell").put("clientRequestId", "shared"), USER);
        svc.createShort(OM.createObjectNode().put("fmtKey", "sell").put("clientRequestId", "shared"), "u_other");
        assertEquals(2, db.size(), "别人的幂等键不能命中我的草稿");
    }

    @Test
    void emptySeedIsRejectedBeforeAnyCharge() throws Exception {
        when(configs.getLong(eq(DramaConfigSeeder.KEY_SHORT_ENTRY), anyLong())).thenReturn(10L);
        JsonNode body = OM.readTree("""
                {"seed":{"title":"空表","shots":[{"durationSec":4,"visual":"","voText":""}]}}
                """);
        BusinessException e = assertThrows(BusinessException.class, () -> svc.createShort(body, USER));
        assertEquals("DRAMA_SHORT_SEED_EMPTY", e.getCode());
        // 语义校验在 hold 之前：既不冻结也不 commit，更不落草稿。
        verify(creditService, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(creditService, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        assertTrue(db.isEmpty());
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

    @Test
    void getShort_resignsExpiredFrameAndVideoUrls() {
        // 用带 fake uploader 的 signer：signedUrlFor(key) → "SIGNED::"+key
        CdnUrlSigner signer = signerWithFakeOss("https://oss.test");
        DramaShortService s = new DramaShortService(repo, OM, creditService, configs, signer,
                new DramaShortContinuityService(OM));

        // 历史草稿：shots 存的是带过期签名参数的 OSS URL（前端只存了 url，没存 key）
        String payload = "{\"step\":\"factory\",\"meta\":null,\"chat\":[],\"refs\":[],"
                + "\"shots\":[{\"id\":\"sh1\",\"flow\":\"done\","
                + "\"frameUrl\":\"https://oss.test/media/drama/frames/a.png?Expires=1&Signature=stale\","
                + "\"frameUrls\":[\"https://oss.test/media/drama/frames/a.png?Expires=1&Signature=stale\"],"
                + "\"videoUrl\":\"https://oss.test/media/drama/clips/v.mp4?Expires=1&Signature=stale\"}]}";
        db.put("dvs_x", DramaShort.builder().id("dvs_x").ownerUserId(USER).payloadJson(payload).build());

        JsonNode shot = s.getShort("dvs_x", USER).get("data").get("shots").get(0);
        // 过期签名参数被丢弃，key 反抽后重签（同 meta 卡片口径），重开草稿不再 403
        assertEquals("SIGNED::media/drama/frames/a.png", shot.get("frameUrl").asText());
        assertEquals("SIGNED::media/drama/frames/a.png", shot.get("frameUrls").get(0).asText());
        assertEquals("SIGNED::media/drama/clips/v.mp4", shot.get("videoUrl").asText());
    }

    /** base-url 命中 → extractKey 砍 query → signedUrlFor 返回 "SIGNED::"+key 的测试用 signer。 */
    private static CdnUrlSigner signerWithFakeOss(String baseUrl) {
        CdnUploader fake = new CdnUploader() {
            @Override public CdnUploadResult upload(Path f, String key, String ct) { return new CdnUploadResult(null, key, 0L, Instant.EPOCH); }
            @Override public void delete(String key) {}
            @Override public String publicUrlFor(String key) { return baseUrl + "/" + key; }
            @Override public String signedUrlFor(String key, long ttl) { return "SIGNED::" + key; }
            @Override public String driverName() { return "fake"; }
        };
        ObjectProvider<CdnUploader> provider = new ObjectProvider<>() {
            @Override public CdnUploader getObject(Object... args) { return fake; }
            @Override public CdnUploader getObject() { return fake; }
            @Override public CdnUploader getIfAvailable() { return fake; }
            @Override public CdnUploader getIfUnique() { return fake; }
        };
        return new CdnUrlSigner(provider, baseUrl, 3600L);
    }

    private static JsonNode readTree(String s) {
        try {
            return OM.readTree(s);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
