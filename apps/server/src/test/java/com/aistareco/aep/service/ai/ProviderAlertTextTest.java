package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ProviderAlertTextTest {
    @Test void preservesNestedSupplierReasonsWhileRedactingCredentialsAndMedia() throws Exception {
        String text=ProviderAlertText.sanitize("{\"error\":{\"code\":\"RATE_LIMIT\",\"message\":\"并发超限\",\"details\":[{\"retry_after\":30,\"api_key\":\"private-key\"}]},\"token\":\"private-token\",\"data\":{\"b64_json\":\"private-media\"},\"url\":\"https://private/a?signature=private-signature\"}");
        var json=new ObjectMapper().readTree(text);
        assertEquals("并发超限",json.path("error").path("message").asText());
        assertEquals(30,json.path("error").path("details").get(0).path("retry_after").asInt());
        for(String secret:new String[]{"private-key","private-token","private-media","private-signature"})assertFalse(text.contains(secret),text);
    }
    @Test void keepsPlainTextErrorDetailsAndExplicitlyMarksLongResponses() {
        assertEquals("503 Service Unavailable",ProviderAlertText.sanitize("503 Service Unavailable"));
        String text=ProviderAlertText.sanitize("upstream overload; authorization=Bearer private-key token=private-token request_id=req-123");
        assertTrue(text.contains("upstream overload"));assertTrue(text.contains("request_id=req-123"));
        assertFalse(text.contains("private-key"));assertFalse(text.contains("private-token"));
        String longText=ProviderAlertText.sanitize("供应商故障".repeat(4000));
        assertTrue(longText.endsWith("完整内容见后台请求日志）"));assertTrue(longText.length()<12100);
    }
    @Test void bodyOnlyEvidenceNeverInventsAnHttpStatus() {
        var error=ProviderResponseDiagnostics.attachBody(new IllegalStateException("failed"),"{\"error\":{\"message\":\"内容审核未通过\"}}");
        var evidence=(ProviderResponseDiagnostics)error.getSuppressed()[0];
        assertNull(evidence.status());assertTrue(evidence.responseBody().contains("内容审核未通过"));
    }
}
