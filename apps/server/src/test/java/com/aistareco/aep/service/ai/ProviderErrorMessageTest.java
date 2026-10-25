package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

class ProviderErrorMessageTest {
    private final ObjectMapper json = new ObjectMapper();

    @ParameterizedTest
    @ValueSource(strings={"{\"error\":{\"message\":\"reason\"}}", "{\"message\":\"reason\"}",
            "{\"error\":\"reason\"}", "{\"data\":{\"error\":{\"msg\":\"reason\"}}}",
            "{\"ResponseMetadata\":{\"Error\":{\"Message\":\"reason\"}}}",
            "{\"result\":{\"failReason\":\"reason\"}}", "{\"error_description\":\"reason\"}"})
    void readsProviderEnvelopes(String body) { assertEquals("reason",ProviderErrorMessage.message(body,"fallback")); }

    @Test void removesSecretsLinksAndBinaryWithoutLosingActionableReason() throws Exception {
        String raw="额度不足 token=private-token Bearer private-bearer sk-privatekey https://provider.example/file?signature=secret data:image/png;base64,YWJjZA==";
        String body=json.createObjectNode().put("message",raw).toString();
        String safe=ProviderErrorMessage.reason(body);
        assertTrue(safe.contains("额度不足"));
        for(String secret:new String[]{"private-token","private-bearer","sk-privatekey","provider.example","signature=secret","YWJjZA=="})assertFalse(safe.contains(secret));
    }

    @ParameterizedTest
    @ValueSource(strings={"", "not json", "<html>message: private</html>", "{}", "{\"error\":{\"message\":\"<html>private</html>\"}}"})
    void unreadableErrorUsesFallback(String body) { assertEquals("fallback",ProviderErrorMessage.message(body,"fallback")); }

    @Test void boundedMessagesDoNotSplitUnicodeAndTruncatedJsonRetainsCompleteMessage() throws Exception {
        String raw="提示"+"😀".repeat(300);
        String safe=ProviderErrorMessage.reason(json.createObjectNode().put("message",raw).toString());
        assertEquals(201,safe.codePointCount(0,safe.length()));
        assertFalse(Character.isHighSurrogate(safe.charAt(safe.length()-2)));
        assertEquals("size invalid",ProviderErrorMessage.reason("{\"error\":{\"message\":\"size invalid\",\"extra\":\"cut…"));
    }
}
