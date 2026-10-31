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

    @Test void policyCodeDoesNotIdentifyAReferenceOrPromptAndDiagnosticsKeepTheOriginal() throws Exception {
        String original="非常抱歉，该提示可能违反了关于暴力内容的防护限制。如果你认为此判断有误，请重试或修改提示语。";
        var body=json.createObjectNode().set("error",json.createObjectNode().put("code","content_policy_violation")
                .put("param","").put("message",original));
        String visible=ProviderErrorMessage.reason(body);
        assertTrue(visible.contains("未说明触发对象"));
        assertTrue(visible.contains("参考素材和生成描述"));
        assertTrue(visible.contains("暴力内容"));
        assertFalse(visible.contains("该提示"));
        assertFalse(visible.startsWith("参考图片"));
        assertFalse(visible.startsWith("输入文本"));
        assertEquals(original,ProviderErrorMessage.diagnosticReason(body));
        assertEquals(visible,ProviderErrorMessage.message(body.toString(),"fallback"));
    }

    @ParameterizedTest
    @ValueSource(strings={"{\"error\":{\"code\":\"content_policy_violation\",\"param\":\"image[]\"}}",
            "{\"error\":{\"code\":\"InputImageSensitiveContentDetected\",\"message\":\"please revise the prompt\"}}",
            "{\"status\":\"failed\",\"data\":{\"errorCode\":\"InputImageSensitiveContentDetected.Violence\"}}"})
    void explicitImageEvidencePointsToTheReferenceEvenWhenAdviceMentionsThePrompt(String body) {
        String visible=ProviderErrorMessage.reason(body);
        assertTrue(visible.startsWith("参考图片未通过内容审核"),visible);
        assertTrue(visible.contains("更换参考图片"));
        assertFalse(visible.contains("未说明触发对象"));
    }

    @Test void distinguishesInputTextInputMediaAndGeneratedOutput() throws Exception {
        assertTrue(ProviderErrorMessage.reason("{\"error\":{\"code\":\"content_filter\",\"param\":\"prompt\"}}").startsWith("输入文本"));
        assertTrue(ProviderErrorMessage.reason("{\"error\":{\"code\":\"InputVideoSensitiveContentDetected\"}}").startsWith("参考视频"));
        assertTrue(ProviderErrorMessage.reason("{\"error\":{\"code\":\"InputAudioSensitiveContentDetected\"}}").startsWith("参考音频"));
        String output="{\"error\":{\"code\":\"moderation_blocked\",\"param\":\"prompt\",\"moderation_details\":{\"moderation_stage\":\"output\",\"categories\":[\"violence\"]}}}";
        assertTrue(ProviderErrorMessage.reason(output).startsWith("生成结果"));
        assertTrue(ProviderErrorMessage.reason(output).contains("暴力内容"));
        String input="{\"error\":{\"code\":\"moderation_blocked\",\"moderation_details\":{\"moderation_stage\":\"input\"}}}";
        assertTrue(ProviderErrorMessage.reason(input).startsWith("输入内容"));
        assertTrue(ProviderErrorMessage.reason(input).contains("生成描述和参考素材"));
        String inputWithVagueOutputAdvice="{\"error\":{\"code\":\"moderation_blocked\",\"message\":\"The generated image may violate safety restrictions\",\"moderation_details\":{\"moderation_stage\":\"input\"}}}";
        assertTrue(ProviderErrorMessage.reason(inputWithVagueOutputAdvice).startsWith("输入内容"));
        String adviceOnly="{\"error\":{\"code\":\"content_policy_violation\",\"message\":\"安全检查未通过，请修改提示词后重试\"}}";
        assertTrue(ProviderErrorMessage.reason(adviceOnly).contains("未说明触发对象"));
    }

    @Test void concreteNestedErrorsBeatGatewayMessagesAndErrorListsAreReadable() {
        assertEquals("input image too large",ProviderErrorMessage.reason("{\"message\":\"success\",\"data\":{\"error\":{\"message\":\"input image too large\"}}}"));
        assertEquals("unsupported size",ProviderErrorMessage.reason("{\"errorMessage\":\"unsupported size\",\"data\":{\"message\":\"success\"}}"));
        assertEquals("unsupported voice",ProviderErrorMessage.reason("{\"errors\":[{\"message\":\"unsupported voice\"}]}"));
        assertEquals("lyrics too long",ProviderErrorMessage.reason("{\"FailureReason\":{\"Code\":\"InvalidParameter\",\"Msg\":\"lyrics too long\"}}"));
    }

    @Test void recognisesNestedHttp200ErrorsWithoutMistakingSuccessfulContentForErrors() throws Exception {
        for(String body:new String[]{"{\"data\":{\"error\":{\"message\":\"bad reference\"}}}",
                "{\"ResponseMetadata\":{\"Error\":{\"Code\":\"InvalidParameter\"}}}","{\"errors\":[{\"message\":\"bad voice\"}]}"})
            assertTrue(ProviderErrorMessage.hasError(json.readTree(body)),body);
        assertFalse(ProviderErrorMessage.hasError(json.readTree("{\"data\":{\"message\":\"success\"},\"error\":null}")));
        assertFalse(ProviderErrorMessage.hasError(json.readTree("{\"choices\":[{\"message\":{\"content\":\"error in a story\"}}]}")));
    }

    @Test void removesSecretsLinksAndBinaryWithoutLosingActionableReason() throws Exception {
        String raw="额度不足 token=private-token Bearer private-bearer sk-privatekey https://provider.example/file?signature=secret data:image/png;base64,YWJjZA==";
        String body=json.createObjectNode().put("message",raw).toString();
        String safe=ProviderErrorMessage.reason(body);
        assertEquals(PublicModelErrorPolicy.UNAVAILABLE, safe);
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
