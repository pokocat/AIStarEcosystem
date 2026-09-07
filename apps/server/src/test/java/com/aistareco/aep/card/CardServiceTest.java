package com.aistareco.aep.card;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.repository.CardProfileRepository;
import com.aistareco.aep.card.service.CardService;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.dap.service.DapAvatarRefResolver;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 名片公开读。
 *
 * <p>这条链路是**匿名可访问**的，所以「什么不该吐出去」比「什么该吐出去」更重要：
 * 未发布、软删、不存在必须是同一个 404，否则短链可以被枚举出哪些名片存在。
 */
class CardServiceTest {

    private static final ObjectMapper OM = new ObjectMapper();

    private DapAssetService assets;
    private CardProfileRepository repo;

    private DapAvatarRefResolver refs;
    private DapAvatarRepository avatarRepo;
    private DapLookRepository lookRepo;

    private CardService service(CardProfile... rows) {
        repo = mock(CardProfileRepository.class);
        for (CardProfile c : rows) {
            when(repo.findBySlug(c.getSlug())).thenReturn(Optional.of(c));
        }
        when(repo.findBySlug("nope")).thenReturn(Optional.empty());
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(anyString())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=1");
        when(signer.maybeSign(anyString())).thenAnswer(i -> i.getArgument(0));
        assets = mock(DapAssetService.class);
        when(repo.save(org.mockito.ArgumentMatchers.any(CardProfile.class)))
                .thenAnswer(i -> i.getArgument(0));
        refs = mock(DapAvatarRefResolver.class);
        // 默认：解析不出来（多数用例不关心形象）。关心的用例自己 stub。
        when(refs.resolve(anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(DapAvatarRefResolver.View.EMPTY);
        avatarRepo = mock(DapAvatarRepository.class);
        lookRepo = mock(DapLookRepository.class);
        when(lookRepo.findByAvatarIdOrderByCreatedAtDesc(anyString())).thenReturn(List.of());
        return new CardService(repo, signer, OM, assets, refs, avatarRepo, lookRepo);
    }

    private CardProfile card(String slug, String status, Instant deletedAt, String payload) {
        return CardProfile.builder()
                .id("CARD-1").ownerUserId("u1").slug(slug).regNo("BC-2041")
                .status(status).avatarId("DH-2041").payloadJson(payload)
                .updatedAt(Instant.parse("2026-09-07T00:00:00Z")).deletedAt(deletedAt)
                .build();
    }

    @Test
    void publishedCardIsReadable() {
        CardProfile c = card("bingfeng", CardProfile.STATUS_PUBLISHED, null,
                "{\"name\":\"冰峰\",\"slug\":\"stale\",\"regNo\":\"BC-0000\"}");
        Map<String, Object> wire = service(c).publicBySlug("bingfeng");

        assertEquals("冰峰", wire.get("name"));
        // 列上的值必须盖过文档里的旧值 —— 短链和登记号的真值在列上。
        assertEquals("bingfeng", wire.get("slug"));
        assertEquals("BC-2041", wire.get("regNo"));
        assertEquals("2026-09-07", wire.get("updatedAt"));
    }

    @Test
    void draftIsNotReadable() {
        CardProfile c = card("draft-one", CardProfile.STATUS_DRAFT, null, "{\"name\":\"x\"}");
        BusinessException e = assertThrows(BusinessException.class, () -> service(c).publicBySlug("draft-one"));
        assertEquals("CARD_NOT_FOUND", e.getCode());
    }

    @Test
    void softDeletedIsNotReadable() {
        CardProfile c = card("gone", CardProfile.STATUS_PUBLISHED, Instant.now(), "{\"name\":\"x\"}");
        BusinessException e = assertThrows(BusinessException.class, () -> service(c).publicBySlug("gone"));
        assertEquals("CARD_NOT_FOUND", e.getCode());
    }

    @Test
    void missingAndUnpublishedShareOneErrorCode() {
        CardProfile draft = card("draft-one", CardProfile.STATUS_DRAFT, null, "{}");
        CardService s = service(draft);
        String a = assertThrows(BusinessException.class, () -> s.publicBySlug("draft-one")).getCode();
        String b = assertThrows(BusinessException.class, () -> s.publicBySlug("nope")).getCode();
        // 同一个码：否则枚举短链就能问出「这张名片存在，只是没发布」。
        assertEquals(a, b);
    }

    @Test
    void cdnKeyDerivesSignedUrlAndKeyIsNotTheContract() {
        CardProfile c = card("k", CardProfile.STATUS_PUBLISHED, null,
                "{\"figure\":{\"tier\":\"static\",\"ref\":\"look:LK-1\",\"imageKey\":\"card/1.jpg\"}}");
        Map<String, Object> wire = service(c).publicBySlug("k");

        @SuppressWarnings("unchecked")
        Map<String, Object> fig = (Map<String, Object>) wire.get("figure");
        assertEquals("https://cdn.test/card/1.jpg?sig=1", fig.get("imageUrl"));
        // 引用本身要留着：名片存的是 dapDisplayRef，不是图。
        assertEquals("look:LK-1", fig.get("ref"));
    }

    @Test
    void demoFlagNeverLeaksFromStoredDoc() {
        // 文档里就算被写进 demo:true，公开读也不能带出去 —— 真名片不许自称演示数据。
        CardProfile c = card("real", CardProfile.STATUS_PUBLISHED, null, "{\"name\":\"x\",\"demo\":true}");
        assertFalse(service(c).publicBySlug("real").containsKey("demo"));
    }

    @Test
    void reservedSlugsAreDeclared() {
        // demo 是前端保留短链（后端未接通时的演示入口），真实名片不许占用。
        assertTrue(CardService.RESERVED_SLUGS.contains("demo"));
    }

    @Test
    void publishRequiresNameAndTitle() {
        CardProfile c = card("x", CardProfile.STATUS_DRAFT, null, "{\"name\":\"冰峰\"}");
        CardService s = service(c);
        when(repo.findById("CARD-1")).thenReturn(Optional.of(c));
        // 发布后匿名可读，所以这是唯一一道内容闸：缺身份不许发。
        BusinessException e = assertThrows(BusinessException.class, () -> s.publish("u1", "CARD-1"));
        assertEquals("CARD_TITLE_REQUIRED", e.getCode());
    }

    @Test
    void publishWritesAssetUsageSoTheAvatarKnowsItIsUsed() {
        CardProfile c = card("x", CardProfile.STATUS_DRAFT, null,
                "{\"name\":\"冰峰\",\"title\":\"路博星科技 · CEO\"}");
        CardService s = service(c);
        when(repo.findById("CARD-1")).thenReturn(Optional.of(c));

        CardProfile out = s.publish("u1", "CARD-1");
        assertEquals(CardProfile.STATUS_PUBLISHED, out.getStatus());
        // 数字资产详情页的「已用于 · 名片」靠这条；形象被删 / 授权撤销也靠它查影响面。
        org.mockito.Mockito.verify(assets).recordUsage(
                org.mockito.ArgumentMatchers.eq("u1"),
                org.mockito.ArgumentMatchers.eq("avatar"),
                org.mockito.ArgumentMatchers.eq("DH-2041"),
                org.mockito.ArgumentMatchers.eq("card"),
                org.mockito.ArgumentMatchers.eq("CARD-1"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void usageFailureNeverBlocksPublish() {
        CardProfile c = card("x", CardProfile.STATUS_DRAFT, null,
                "{\"name\":\"冰峰\",\"title\":\"CEO\"}");
        CardService s = service(c);
        when(repo.findById("CARD-1")).thenReturn(Optional.of(c));
        org.mockito.Mockito.doThrow(new RuntimeException("boom")).when(assets).recordUsage(
                anyString(), anyString(), anyString(), anyString(), anyString(),
                anyString(), anyString(), org.mockito.ArgumentMatchers.isNull());
        // 用量是观测数据（§8.0 旁路例外），丢了不该让名片发不出去。
        assertEquals(CardProfile.STATUS_PUBLISHED, s.publish("u1", "CARD-1").getStatus());
    }

    @Test
    void reservedAndMalformedSlugsAreRejected() {
        CardService s = service();
        when(repo.findBySlug(anyString())).thenReturn(Optional.empty());
        assertEquals("CARD_SLUG_RESERVED",
                assertThrows(BusinessException.class, () -> s.create("u1", "demo", null, Map.of())).getCode());
        assertEquals("CARD_SLUG_INVALID",
                assertThrows(BusinessException.class, () -> s.create("u1", "AB", null, Map.of())).getCode());
        assertEquals("CARD_SLUG_INVALID",
                assertThrows(BusinessException.class, () -> s.create("u1", "有中文", null, Map.of())).getCode());
    }

    @Test
    void takenSlugIsRejected() {
        CardProfile mine = card("taken", CardProfile.STATUS_PUBLISHED, null, "{}");
        CardService s = service(mine);
        assertEquals("CARD_SLUG_TAKEN",
                assertThrows(BusinessException.class, () -> s.create("u2", "taken", null, Map.of())).getCode());
    }

    @Test
    void otherPeoplesCardLooksLikeItDoesNotExist() {
        CardProfile c = card("x", CardProfile.STATUS_PUBLISHED, null, "{}");
        CardService s = service(c);
        when(repo.findById("CARD-1")).thenReturn(Optional.of(c));
        // 不是「无权限」而是「不存在」：否则可以拿别人的 id 探出名片存在与否。
        assertEquals("CARD_NOT_FOUND",
                assertThrows(BusinessException.class, () -> s.required("someone-else", "CARD-1")).getCode());
    }

    @Test
    void saveDropsSignedUrlsThatWereDerivedFromKeys() {
        // 编辑器 GET 到的文档带着现签的 imageUrl（有 TTL），原样 PUT 回来时必须被剥掉 ——
        // 真值是 imageKey，把一小时后就过期的签名 URL 写进 payload_json 既无用又是签名外泄（§4.7.4）。
        CardProfile c = card("me", CardProfile.STATUS_DRAFT, null, "{}");
        CardService s = service(c);
        when(repo.findById("CARD-1")).thenReturn(Optional.of(c));

        s.save("u1", "CARD-1", null, null, Map.of(
                "figure", Map.of(
                        "imageKey", "cards/CARD-1/hero.jpg",
                        "imageUrl", "https://cdn.test/cards/CARD-1/hero.jpg?sig=EXPIRES"),
                // 没有 key 兄弟的 URL 是用户自己填的外链，必须原样保留
                "siteUrl", "https://example.com/me"));

        assertFalse(c.getPayloadJson().contains("sig=EXPIRES"), "派生出来的签名 URL 不该落库");
        assertFalse(c.getPayloadJson().contains("imageUrl"), "有 key 兄弟的 URL 字段应当被剥掉");
        assertTrue(c.getPayloadJson().contains("cards/CARD-1/hero.jpg"), "key 是真值，必须留着");
        assertTrue(c.getPayloadJson().contains("https://example.com/me"), "用户填的外链不能误删");
    }

    @Test
    void figureRefsAreResolvedOnRead_andBrokenLooksDropOutOfTheWardrobe() {
        // 名片存的是引用不是图。这一步不做，真名片就是「有个 ref 字段、没有形象」——
        // 演示名片能显示只是因为它写死了 imageUrl，把这个缺陷盖住了。
        String payload = "{\"name\":\"林一\",\"figure\":{\"tier\":\"static\",\"ref\":null,"
                + "\"looks\":[{\"ref\":\"look:LK-1\",\"label\":\"日常潮玩装\"},"
                + "{\"ref\":\"look:LK-GONE\",\"label\":\"已被删掉的造型\"}]}}";
        CardProfile c = card("lin", CardProfile.STATUS_PUBLISHED, null, payload);
        CardService s = service(c);
        when(refs.resolve("DH-2041", null))
                .thenReturn(new DapAvatarRefResolver.View("林一", "https://cdn.test/main.jpg?sig=1"));
        when(refs.resolve("DH-2041", "look:LK-1"))
                .thenReturn(new DapAvatarRefResolver.View("林一", "https://cdn.test/lk1.jpg?sig=1"));
        when(refs.resolve("DH-2041", "look:LK-GONE"))
                .thenReturn(DapAvatarRefResolver.View.EMPTY);

        @SuppressWarnings("unchecked")
        Map<String, Object> figure = (Map<String, Object>) s.publicBySlug("lin").get("figure");
        assertEquals("https://cdn.test/main.jpg?sig=1", figure.get("imageUrl"), "主图必须由 ref 解析出来");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> looks = (List<Map<String, Object>>) figure.get("looks");
        // 解析不出来的那件要从衣柜里拿掉 —— 切过去是一片空白，比不给这个选项更糟
        assertEquals(1, looks.size(), "解析不出的造型不该留在衣柜里");
        assertEquals("日常潮玩装", looks.get(0).get("label"));
        assertEquals("https://cdn.test/lk1.jpg?sig=1", looks.get(0).get("imageUrl"));
    }

    @Test
    void createFromAvatarPrefillsNameAndWardrobe() {
        CardService s = service();
        when(avatarRepo.findById("DH-9")).thenReturn(Optional.of(DapAvatar.builder()
                .id("DH-9").ownerUserId("u1").name("林一").build()));
        when(lookRepo.findByAvatarIdOrderByCreatedAtDesc("DH-9")).thenReturn(List.of(
                DapLook.builder().id("LK-1").avatarId("DH-9").label("日常潮玩装").imageKey("k1").build(),
                DapLook.builder().id("LK-2").avatarId("DH-9").label("表情 · 开心大笑").imageKey("k2").build(),
                // 还没出图的不进衣柜
                DapLook.builder().id("LK-3").avatarId("DH-9").label("跑失败的").build()));
        when(repo.findBySlug("dh-9")).thenReturn(Optional.empty());

        CardProfile c = s.createFromAvatar("u1", "DH-9", null);
        assertEquals(CardProfile.STATUS_DRAFT, c.getStatus(), "一键建卡只能建草稿，不能直接挂上公网");
        assertEquals("DH-9", c.getAvatarId());
        String doc = c.getPayloadJson();
        assertTrue(doc.contains("林一"), "名字要从形象带过来，别再问用户一遍：" + doc);
        assertTrue(doc.contains("look:LK-1") && doc.contains("look:LK-2"), "造型要进衣柜：" + doc);
        assertFalse(doc.contains("look:LK-3"), "没出图的造型不该进衣柜：" + doc);
    }

    @Test
    void createFromAvatarRejectsSomeoneElsesAvatar() {
        CardService s = service();
        when(avatarRepo.findById("DH-9")).thenReturn(Optional.of(DapAvatar.builder()
                .id("DH-9").ownerUserId("someone-else").name("别人的").build()));
        assertEquals("DAP_AVATAR_NOT_FOUND",
                assertThrows(BusinessException.class, () -> s.createFromAvatar("u1", "DH-9", null)).getCode());
    }

    @Test
    void affectedByAvatarIsNullSafe() {
        // 形象被删时反查受影响名片；avatarId 为空不该炸，返回空列表。
        assertEquals(List.of(), service().affectedByAvatar(null));
    }
}
