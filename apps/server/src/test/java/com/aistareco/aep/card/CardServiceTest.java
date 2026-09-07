package com.aistareco.aep.card;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.repository.CardProfileRepository;
import com.aistareco.aep.card.service.CardService;
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

    private CardService service(CardProfile... rows) {
        CardProfileRepository repo = mock(CardProfileRepository.class);
        for (CardProfile c : rows) {
            when(repo.findBySlug(c.getSlug())).thenReturn(Optional.of(c));
        }
        when(repo.findBySlug("nope")).thenReturn(Optional.empty());
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(anyString())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=1");
        when(signer.maybeSign(anyString())).thenAnswer(i -> i.getArgument(0));
        return new CardService(repo, signer, OM);
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
    void affectedByAvatarIsNullSafe() {
        // 形象被删时反查受影响名片；avatarId 为空不该炸，返回空列表。
        assertEquals(List.of(), service().affectedByAvatar(null));
    }
}
