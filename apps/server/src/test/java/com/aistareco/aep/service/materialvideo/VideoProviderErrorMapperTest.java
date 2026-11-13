package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VideoProviderErrorMapperTest {
    @Test
    void oversizedInputIsDeterministicAtSubmitAndAfterAnAcceptedJobFails() {
        String reason = "invalid argument input image long side exceeds 5760";
        String response = "{\"error\":{\"code\":\"CLIENT_ERROR\",\"message\":\"" + reason + "\"}}";
        var expected = "VIDEO_REF_IMAGE_SIZE_INVALID";
        assertEquals(expected, VideoProviderErrorMapper.submit(400, response).orElseThrow().code());
        assertEquals(expected, VideoProviderErrorMapper.poll(response).orElseThrow().code());
        assertEquals(expected, VideoProviderErrorMapper.poll("{}", reason).orElseThrow().code());
        assertTrue(VideoProviderErrorMapper.submit(502, response).isEmpty(), "a gateway error does not prove a create was rejected");
    }

    @Test
    void realPersonRestrictionExplainsTheRequiredInputChangeWithoutLeakingWireDetails() {
        String response = "{\"error\":{\"code\":\"InputImageSensitiveContentDetected.PrivacyInformation\","
                + "\"message\":\"The input image 'content[1]' 'content[2]' 'content[3]' may contain real person. Request id: private-trace\"}}";
        var mapped = VideoProviderErrorMapper.submit(400, response).orElseThrow();
        assertEquals("VIDEO_REFERENCE_PERSON_RESTRICTED", mapped.code());
        assertTrue(mapped.publicMessage(response).contains("真人"));
        assertTrue(mapped.publicMessage(response).contains("更换参考图片"));
        assertTrue(mapped.publicMessage(response).contains("Seedance 2.5"), "别的模型可以用这些素材，要告诉用户");
        assertFalse(mapped.publicMessage(response).contains("content["));
        assertFalse(mapped.publicMessage(response).contains("private-trace"));
        assertTrue(VideoProviderErrorMapper.submit(503, response).isEmpty(), "do not reclassify uncertain server failures");
    }

    /** 2026-11-07 OneToken Seedance 2.0：任务查询到 failed，原因是对方内部错误，提示里还写着幂等键。 */
    @Test
    void aSupplierInternalFailureWhilePollingIsARetryNotTheSuppliersWords() {
        String response = "{\"status\":\"failed\",\"error\":{\"category\":\"internal\",\"code\":\"InternalServiceError\","
                + "\"hint\":\"此 Idempotency-Key 只会回放已保存的创建响应；请稍候再用新的 Idempotency-Key 提交。\"}}";
        var mapped = VideoProviderErrorMapper.poll(response).orElseThrow();
        assertEquals("VIDEO_PROVIDER_INTERNAL", mapped.code());
        assertTrue(mapped.message().contains("重新生成"));
        assertFalse(mapped.message().contains("Idempotency"));
        assertEquals("VIDEO_PROVIDER_INTERNAL", VideoProviderErrorMapper.poll("{\"code\":\"InternalServiceError\"}").orElseThrow().code());
        assertTrue(VideoProviderErrorMapper.poll("{\"status\":\"failed\",\"error\":{\"code\":\"content_filter\"}}").isEmpty(), "other reasons keep their own handling");
        assertTrue(VideoProviderErrorMapper.poll("not json").isEmpty());
    }

    @Test
    void structuredAudioCopyrightReasonTakesPriorityOverTheGenericInternalCodeAndExplainsWhatToChange() {
        // 2026-11-13 OneToken Seedance 2.5: two HTTP 200 failed polls; no request content or identifiers.
        String response = """
                {"status":"failed","error":{"category":"service_rejected","code":"InternalServiceError",
                "reason":"copyright_audio","message":"生成的音频可能涉及版权限制，请关闭音频（generate_audio=false）或调整提示词后重试。"}}
                """;
        var mapped = VideoProviderErrorMapper.poll(response).orElseThrow();
        assertEquals("VIDEO_AUDIO_COPYRIGHT_RESTRICTED", mapped.code());
        assertTrue(mapped.message().contains("服务方提示"), "report the supplier's assessment, not a finding of infringement");
        assertTrue(mapped.message().contains("音频可能涉及版权限制"));
        assertTrue(mapped.message().contains("调整提示词"));
        assertFalse(mapped.message().contains("generate_audio"));
        assertFalse(mapped.message().contains("临时出错"));
        assertEquals(mapped.message(), com.aistareco.aep.service.ai.PublicModelErrorPolicy.stored(mapped.message(), mapped.code()));
        assertTrue(VideoProviderErrorMapper.submit(502, response).isEmpty(), "poll classification must not change uncertain create handling");
    }

    @Test
    void serviceBusyAndUnknownReasonsKeepTheirExistingClassification() {
        for (String reason : java.util.List.of("service_busy", "unknown_reason")) {
            String response = "{\"error\":{\"category\":\"service_rejected\",\"code\":\"InternalServiceError\",\"reason\":\"" + reason + "\"}}";
            assertEquals("VIDEO_PROVIDER_INTERNAL", VideoProviderErrorMapper.poll(response).orElseThrow().code());
        }
        assertTrue(VideoProviderErrorMapper.poll("{\"error\":{\"category\":\"service_rejected\",\"reason\":\"unknown_reason\"}}").isEmpty());
        assertTrue(VideoProviderErrorMapper.poll("{\"error\":{\"category\":\"service_rejected\",\"reason\":\"copyright_audio\"}}").isEmpty());
        assertEquals("VIDEO_PROVIDER_INTERNAL", VideoProviderErrorMapper.poll("""
                {"error":{"category":"internal","code":"InternalServiceError","reason":"copyright_audio"}}
                """).orElseThrow().code(), "a reason token alone does not establish this known rejection");
        assertEquals("VIDEO_PROVIDER_INTERNAL", VideoProviderErrorMapper.poll("""
                {"error":{"code":"InternalServiceError","message":"copyright_audio"}}
                """).orElseThrow().code(), "do not classify by message keywords");
    }

    @Test
    void mapsKnownProviderCodeToStablePlatformCode() {
        var mapped = VideoProviderErrorMapper.submit(503,
                "{\"code\":\"video_queue_full\",\"message\":\"video queue is full\"}").orElseThrow();
        assertEquals("VIDEO_PROVIDER_QUEUE_FULL", mapped.code());
        assertTrue(mapped.message().contains("模型提供方"));
        assertTrue(mapped.message().contains("队列已满"));
        assertFalse(mapped.message().contains("Agnes"));
        assertFalse(mapped.message().contains("你目前排在"));

        assertEquals("VIDEO_PROVIDER_QUEUE_FULL", VideoProviderErrorMapper.submit(503,
                "{\"error\":{\"code\":\"VIDEO_QUEUE_FULL\"}}").orElseThrow().code());
    }

    @Test
    void unknownCodesAndGatewayPagesUseExistingFallback() {
        assertTrue(VideoProviderErrorMapper.submit(503, "{\"code\":\"other\"}").isEmpty());
        assertTrue(VideoProviderErrorMapper.submit(502, "{\"code\":\"video_queue_full\"}").isEmpty());
        assertTrue(VideoProviderErrorMapper.submit(503, "<html>error</html>").isEmpty());
    }

    /** 2026-10-20 seedance20-onetoken, the body as logged. */
    @Test
    void aRetiredModelGetsItsOwnCodeSoClientsStopResubmitting() {
        var mapped = VideoProviderErrorMapper.submit(400,
                "{\"error\":{\"code\":\"model_delisted\",\"message\":\"model doubao-seedance-2-0-260128 has been retired; see https://app.onetoken.love/models for the available video models\"}}").orElseThrow();
        assertEquals("VIDEO_MODEL_RETIRED", mapped.code());
        assertTrue(mapped.message().contains("换一个模型"));
        assertFalse(mapped.message().contains("onetoken"), "no vendor URL on screen");
    }

    @Test
    void aModelTheProviderRetiredIsRefusedBeforeAnotherSubmissionUntilItIsRebound() {
        var client = new MaterialVideoModelClient(null, null, null, null, null);
        var retired = com.aistareco.aep.model.AiModelEndpoint.builder().id("seedance20-onetoken").model("doubao-seedance-2-0-260128").build();
        var other = com.aistareco.aep.model.AiModelEndpoint.builder().id("ai-jusuan-minimax-h3").model("minimax-h3").build();
        client.requireNotRetired(retired, "doubao-seedance-2-0-260128");
        client.markRetired(retired, "doubao-seedance-2-0-260128");
        var refused = assertThrows(com.aistareco.common.BusinessException.class, () -> client.requireNotRetired(retired, "doubao-seedance-2-0-260128"));
        assertEquals("VIDEO_MODEL_RETIRED", refused.getCode());
        client.requireNotRetired(other, "minimax-h3");
        client.requireNotRetired(retired, "doubao-seedance-2-1"); // the same endpoint rebound to another model is allowed
    }
}
