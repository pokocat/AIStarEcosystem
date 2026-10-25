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
    @Test void diagnosticEvidenceStillContainsTheSupplierReason() {
        assertTrue(ProviderErrorMessage.diagnostic("余额不足 ¥0.0123").contains("0.0123"));
        var failure=ProviderResponseDiagnostics.attachBody(new IllegalStateException("public"),"{\"error\":{\"message\":\"余额不足 ¥0.0123\"}}");
        assertTrue(((ProviderResponseDiagnostics)failure.getSuppressed()[0]).responseBody().contains("0.0123"));
    }
}
