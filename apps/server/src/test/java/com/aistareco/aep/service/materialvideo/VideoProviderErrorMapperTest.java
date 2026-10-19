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
}
