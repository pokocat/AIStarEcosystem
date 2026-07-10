package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * C-1 参考生效回报（applied_refs）纯函数矩阵：
 * computeFrameAppliedRefs（fetchable 过滤 + role=ref）/ computeClipAppliedRefs（首尾帧 vs 端点能力）/
 * supportsFirstLastFrame（协议关键字静态判定，与 MaterialVideoModelClient.protocolFor 同口径）。
 * 无 Spring / 无网络。
 */
class DramaRenderServiceTest {

    private final ObjectMapper om = new ObjectMapper();

    private ArrayNode refs(String... urls) {
        ArrayNode arr = om.createArrayNode();
        for (String u : urls) arr.add(u);
        return arr;
    }

    // ── computeFrameAppliedRefs ─────────────────────────────────────────────

    @Test
    void frame_all_fetchable_refs_applied() {
        var a = DramaRenderService.computeFrameAppliedRefs(
                refs("https://cdn.example.com/a.png", "http://img.example.com/b.png"));
        assertEquals(2, a.requested());
        assertEquals(2, a.appliedCount());
        assertTrue(a.items().stream().allMatch(r -> "ref".equals(r.role()) && r.applied() && r.reason() == null));
    }

    @Test
    void frame_local_and_relative_refs_dropped_with_reason() {
        var a = DramaRenderService.computeFrameAppliedRefs(refs(
                "https://cdn.example.com/ok.png",
                "/cdn/drama/frames/x.png",              // dev fake-CDN 相对路径
                "http://localhost:8080/cdn/y.png",      // 本机地址
                "http://192.168.1.10/z.png"));          // 内网地址
        assertEquals(4, a.requested());
        assertEquals(1, a.appliedCount());
        assertEquals(java.util.List.of("https://cdn.example.com/ok.png"), a.validUrls());
        a.items().stream().filter(r -> !r.applied())
                .forEach(r -> assertEquals("local_unfetchable", r.reason()));
    }

    @Test
    void frame_null_or_empty_refs_yield_empty_report() {
        var a = DramaRenderService.computeFrameAppliedRefs(null);
        assertEquals(0, a.requested());
        assertEquals(0, a.appliedCount());
        var b = DramaRenderService.computeFrameAppliedRefs(refs("", "  "));
        assertEquals(0, b.requested());
    }

    // ── computeClipAppliedRefs ──────────────────────────────────────────────

    @Test
    void clip_first_and_last_frame_applied_when_model_supports_flf() {
        var a = DramaRenderService.computeClipAppliedRefs(
                "https://cdn.example.com/first.png", "https://cdn.example.com/last.png", true);
        assertEquals(2, a.requested());
        assertEquals(2, a.appliedCount());
        assertEquals("first_frame", a.items().get(0).role());
        assertEquals("last_frame", a.items().get(1).role());
    }

    @Test
    void clip_last_frame_dropped_when_model_has_no_flf() {
        var a = DramaRenderService.computeClipAppliedRefs(
                "https://cdn.example.com/first.png", "https://cdn.example.com/last.png", false);
        assertEquals(2, a.requested());
        assertEquals(1, a.appliedCount());
        var last = a.items().get(1);
        assertEquals("last_frame", last.role());
        assertFalse(last.applied());
        assertEquals("model_no_flf", last.reason());
        // 首帧不受能力开关影响
        assertTrue(a.items().get(0).applied());
    }

    @Test
    void clip_local_frames_dropped_as_unfetchable() {
        var a = DramaRenderService.computeClipAppliedRefs("/cdn/first.png", "/cdn/last.png", true);
        assertEquals(2, a.requested());
        assertEquals(0, a.appliedCount());
        a.items().forEach(r -> assertEquals("local_unfetchable", r.reason()));
    }

    @Test
    void clip_without_frames_yields_empty_report() {
        var a = DramaRenderService.computeClipAppliedRefs(null, "", true);
        assertEquals(0, a.requested());
    }

    // ── supportsFirstLastFrame ─────────────────────────────────────────────

    @Test
    void supports_flf_by_protocol_keywords() {
        assertTrue(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("豆包 Seedance").model("doubao-seedance-pro").build()));
        // GENERIC：best-effort 带 end_image，视为支持（下游不认则忽略，不误报）
        assertTrue(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("通用 i2v").baseUrl("https://api.vendor.com/v1").build()));
        // AGNES 仅首帧
        assertFalse(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("Agnes Video").baseUrl("https://agnes.example.com").build()));
        assertFalse(DramaRenderService.supportsFirstLastFrame(null));
    }

    @Test
    void applied_refs_reason_is_null_for_applied_items() {
        var a = DramaRenderService.computeClipAppliedRefs("https://cdn.example.com/f.png", null, true);
        assertEquals(1, a.requested());
        assertNull(a.items().get(0).reason());
    }
}
