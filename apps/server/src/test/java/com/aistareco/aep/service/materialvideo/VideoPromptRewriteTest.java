package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 厂商出片前改写提示词的结果：解析、留存与画布投影只在 {@link VideoPromptRewrite} 一处。 */
class VideoPromptRewriteTest {

    private final ObjectMapper om = new ObjectMapper();

    @Test
    @DisplayName("effectivePrompt 优先，缺了读 optimizedPrompt；超长截断；不是对象 → null")
    void parsesVendorObject() throws Exception {
        var rewrite = VideoPromptRewrite.fromVendor(om.readTree(
                "{\"promptOptimization\":{\"status\":\"succeeded\",\"promptSource\":\"optimized\",\"optimizedPrompt\":\"B\"}}"));
        assertEquals("B", rewrite.prompt());
        assertEquals(VideoPromptRewrite.MAX_PROMPT_CHARS, VideoPromptRewrite.fromVendor(om.readTree(
                "{\"promptOptimization\":{\"status\":\"succeeded\",\"effectivePrompt\":\"" + "x".repeat(9000) + "\"}}"))
                .prompt().length());
        assertNull(VideoPromptRewrite.fromVendor(om.readTree("{\"promptOptimization\":true}")));
        assertNull(VideoPromptRewrite.fromVendor(null));
    }

    @Test
    @DisplayName("画布投影：按原文生成 → off；改写中 → running；改写成功给出实际用的描述；用原文 → done 不带描述；内部记录号不出 wire")
    void wireProjection() {
        String off = "{\"generation_mode\":\"t2v\",\"resolution_tier\":\"768p\",\"optimize_prompt\":false}";
        assertEquals("{\"state\":\"off\"}", VideoPromptRewrite.wire(om, off, null).toString());

        String running = payload(new VideoPromptRewrite("processing", null, null, null, null));
        assertEquals("{\"state\":\"running\"}", VideoPromptRewrite.wire(om, "{}", running).toString());

        String done = payload(new VideoPromptRewrite("succeeded", "optimized", "English (S1) <d>[Chinese]等等</d>", "popt_1", "v8"));
        var wire = VideoPromptRewrite.wire(om, "{}", done);
        assertEquals("done", wire.path("state").asText());
        assertEquals("English (S1) <d>[Chinese]等等</d>", wire.path("prompt").asText());
        assertFalse(wire.has("optimizationId"));
        assertFalse(wire.has("version"));

        String original = payload(new VideoPromptRewrite("succeeded", "original", "原文", null, null));
        assertEquals("{\"state\":\"done\"}", VideoPromptRewrite.wire(om, "{}", original).toString());
        assertEquals("{\"state\":\"failed\"}", VideoPromptRewrite.wire(om, "{}",
                payload(new VideoPromptRewrite("failed", null, null, null, null))).toString());

        // 模型不改写 / 老任务：不出这个字段
        assertNull(VideoPromptRewrite.wire(om, "{}", "{\"name\":\"画布视频\"}"));
        assertNull(VideoPromptRewrite.wire(om, null, "not json"));
    }

    private String payload(VideoPromptRewrite rewrite) {
        var node = om.createObjectNode().put("name", "画布视频");
        node.set(VideoPromptRewrite.PAYLOAD_KEY, rewrite.toJson(om));
        return node.toString();
    }
}
