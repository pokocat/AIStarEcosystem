package com.aistareco.aep.service.materialvideo;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class VideoProviderErrorMapperTest {
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
