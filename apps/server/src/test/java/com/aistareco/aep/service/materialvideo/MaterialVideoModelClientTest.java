package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * 视频大模型响应解析的多形态兜底（normalizeStatus / extractVideoUrl）。
 * 纯函数，无 Spring / HTTP；保证换厂商时常见 wire 形态都能解析。
 */
class MaterialVideoModelClientTest {

    private final ObjectMapper om = new ObjectMapper();

    private JsonNode json(String s) {
        try {
            return om.readTree(s);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void normalizeStatus_maps_common_vendor_values() {
        // 成功类
        assertEquals("succeeded", MaterialVideoModelClient.normalizeStatus("SUCCESS"));   // 智谱 CogVideoX
        assertEquals("succeeded", MaterialVideoModelClient.normalizeStatus("succeeded"));
        assertEquals("succeeded", MaterialVideoModelClient.normalizeStatus("Completed"));
        assertEquals("succeeded", MaterialVideoModelClient.normalizeStatus("done"));
        // 失败类
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("FAIL"));         // 智谱
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("failed"));
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("error"));
        // 进行中（含未知 / null 兜底为 processing，避免误判为失败）
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("PROCESSING"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("RUNNING"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("queued"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus(null));
    }

    @Test
    void extractVideoUrl_cogvideox_shape() {
        // 智谱 CogVideoX：video_result[0].url
        JsonNode root = json("""
            {"task_status":"SUCCESS","video_result":[{"url":"https://cdn/x.mp4","cover_image_url":"https://cdn/x.jpg"}]}
            """);
        assertEquals("https://cdn/x.mp4", MaterialVideoModelClient.extractVideoUrl(root));
    }

    @Test
    void extractVideoUrl_generic_shapes() {
        assertEquals("https://a/v.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("{\"video_url\":\"https://a/v.mp4\"}")));
        assertEquals("https://b/v.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("{\"data\":{\"video_url\":\"https://b/v.mp4\"}}")));
        assertEquals("https://c/v.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("{\"videos\":[{\"url\":\"https://c/v.mp4\"}]}")));
        assertEquals("https://d/v.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("{\"output\":{\"video_url\":\"https://d/v.mp4\"}}")));
    }

    @Test
    void extractVideoUrl_returns_null_when_not_ready() {
        // 进行中：还没有成片 URL
        assertNull(MaterialVideoModelClient.extractVideoUrl(json("{\"task_status\":\"PROCESSING\"}")));
    }
}
