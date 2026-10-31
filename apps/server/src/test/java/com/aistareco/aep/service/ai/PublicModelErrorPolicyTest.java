package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class PublicModelErrorPolicyTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @ParameterizedTest
    @ValueSource(strings={"预扣费额度失败, 用户剩余额度: ¥0.0123, 需要预扣费额度: ¥0.4567 (request id: [已脱敏])",
            "insufficient_quota account balance $0.01", "供应商余额不足", "billing hard limit exceeded", "api_key=private-secret"})
    void neverReturnsSupplierOperatingDetails(String reason) {
        assertEquals(PublicModelErrorPolicy.UNAVAILABLE, ProviderErrorMessage.sanitize(reason));
    }
    @Test void realWalletAndActionableMediaProblemsArePreserved() {
        String wallet = "积分余额不足，本次操作需 320，当前可用 16。请补足积分后点击“继续”。本步尚未提交，未扣积分。";
        assertEquals(wallet, PublicModelErrorPolicy.stored(wallet,"STUDIO_PAYMENT_REQUIRED"));
        assertEquals("size invalid",ProviderErrorMessage.sanitize("size invalid"));
        assertEquals("输入图片未通过内容审核",ProviderErrorMessage.sanitize("输入图片未通过内容审核"));
    }
    @Test void oldErrorsAreFilteredWithoutRewritingCustomerContentOrSourceEvidence() throws Exception {
        var original=mapper.readTree("{\"draft\":\"剧情：预扣费额度失败 ¥0.0123\",\"assets\":[{\"image\":{\"error\":{\"code\":\"STUDIO_IMAGE_PROVIDER_FAILED\",\"message\":\"图片生成服务返回错误：预扣费额度失败 ¥0.0123 · 追查号 ABCDEF234567\",\"logId\":\"ABCDEF234567\"}}}],\"cost\":320}");
        var safe=PublicModelErrorPolicy.response(original);
        assertEquals(original.path("draft"),safe.path("draft"));assertEquals(320,safe.path("cost").asInt());
        var error=safe.path("assets").get(0).path("image").path("error");
        assertEquals(PublicModelErrorPolicy.UNAVAILABLE+" · 追查号 ABCDEF234567",error.path("message").asText());
        assertEquals("ABCDEF234567",error.path("logId").asText());
        assertTrue(original.path("assets").get(0).path("image").path("error").path("message").asText().contains("0.0123"));
    }
    /** 2026-10-30: the supplier's 「清理资源(含回收站)」 sent customers to delete their own work. */
    @Test void aFullSupplierStorageIsNotTheCustomersToClean() throws Exception {
        String body = "{\"error\":{\"code\":\"personal_asset_quota_exceeded\",\"message\":\"个人资源空间不足，请清理资源(含回收站)或扩容后重试\",\"retryable\":false}}";
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL, ProviderErrorMessage.reason(body));
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL, ProviderErrorMessage.sanitize("Personal asset quota exceeded"));
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL,
                ProviderErrorMessage.append(body, "视频生成失败"), "the supplier's words are not appended to ours");
        // Already stored before this fix: replaced when read back, the trace number kept.
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL + " · 追查号 ABCDEF234567", PublicModelErrorPolicy.stored(
                "视频生成失败；个人资源空间不足，请清理资源(含回收站)或扩容后重试 · 追查号 ABCDEF234567", "VIDEO_SUBMIT_FAILED"));
        var safe = PublicModelErrorPolicy.response(mapper.readTree(
                "{\"status\":\"failed\",\"errorCode\":\"STUDIO_SPEECH_PROVIDER_FAILED\",\"errorMessage\":\"个人资源空间不足，请清理资源(含回收站)或扩容后重试\"}"));
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL, safe.path("errorMessage").asText());
        assertEquals(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL, PublicModelErrorPolicy.stored(PublicModelErrorPolicy.SUPPLIER_STORAGE_FULL, "VIDEO_SUBMIT_FAILED"));
    }
    @Test void ourOwnStorageMessagesAreLeftAlone() {
        String own = "空间不够了，删掉一些不用的素材或成片，也可以去扩容";
        assertEquals(own, PublicModelErrorPolicy.stored(own, "CLIP_ASSET_QUOTA_EXCEEDED"));
    }
    @Test void diagnosticEvidenceStillContainsTheSupplierReason() {
        assertTrue(ProviderErrorMessage.diagnostic("余额不足 ¥0.0123").contains("0.0123"));
        var failure=ProviderResponseDiagnostics.attachBody(new IllegalStateException("public"),"{\"error\":{\"message\":\"余额不足 ¥0.0123\"}}");
        assertTrue(((ProviderResponseDiagnostics)failure.getSuppressed()[0]).responseBody().contains("0.0123"));
    }
}
