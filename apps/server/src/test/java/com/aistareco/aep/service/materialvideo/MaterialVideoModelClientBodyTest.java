package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 请求体组包（docs/video-studio-plan.md §5.2）：
 * <ul>
 *   <li>视频生成区的四种模式照 Portal 示例组包（字段集与顺序）；</li>
 *   <li>老路径（resolutionTier == null）与改动前逐字段一致；</li>
 *   <li>seedance / agnes / 通用协议：画布的首帧 key 换成 URL 放进各自的首帧位，且优先于 prompt 里的首帧标记；
 *       只带标记的短剧请求体逐字节不变。</li>
 * </ul>
 */
class MaterialVideoModelClientBodyTest {

    private final ObjectMapper om = new ObjectMapper();
    private final MaterialVideoModelClient client =
            new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);

    private static final String JUSUAN = "jusuan-media";
    private static final List<String> FORBIDDEN = List.of("fps", "frames", "width", "height", "steps", "num_frames");

    private String json(Object body) {
        try {
            return om.writeValueAsString(body);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ── 视频生成区：H3 原生组包 ─────────────────────────────────────────────

    @Test
    @DisplayName("文生视频 1:1 → orientation=square + aspectRatio + outputSizeCode，字段顺序照 Portal，没有种子也没有素材字段")
    void t2vSquare() {
        VideoGenSpec spec = new VideoGenSpec("t2v", "768p", null, null, null, List.of());
        Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", "一只猫在窗台上打盹", 5, "1:1",
                spec, MaterialVideoModelClient.UpstreamInputs.NONE);

        assertEquals(List.of("model", "generationMode", "prompt", "resolutionTier", "orientation", "aspectRatio",
                "outputSizeCode", "seconds"), List.copyOf(body.keySet()));
        assertEquals("minimax-h3", body.get("model"));
        assertEquals("t2v", body.get("generationMode"));
        assertEquals("一只猫在窗台上打盹", body.get("prompt"));
        assertEquals("768p", body.get("resolutionTier"));
        assertEquals("square", body.get("orientation"));
        assertEquals("1:1", body.get("aspectRatio"));
        assertEquals("h3-768-1x1", body.get("outputSizeCode"));
        assertEquals(5, body.get("seconds"));
        FORBIDDEN.forEach(f -> assertFalse(body.containsKey(f), f));
    }

    @Test
    @DisplayName("首帧生视频：带 input_image_asset_id；种子只在设置了时出现，0 也算设置")
    void i2vWithSeed() {
        VideoGenSpec spec = new VideoGenSpec("i2v", "544p", 0L, "video-studio-image/u1/a.png", null, List.of());
        Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", "她回头一笑", 8, "9:16", spec,
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("asset_first"));

        assertEquals(List.of("model", "generationMode", "prompt", "resolutionTier", "orientation", "aspectRatio",
                "outputSizeCode", "seconds", "seed", "input_image_asset_id"), List.copyOf(body.keySet()));
        assertEquals("i2v", body.get("generationMode"));
        assertEquals("portrait", body.get("orientation"));
        assertEquals("h3-544-9x16", body.get("outputSizeCode"));
        assertEquals(0L, body.get("seed"));
        assertEquals("asset_first", body.get("input_image_asset_id"));
        assertFalse(body.containsKey("end_image_asset_id"));
    }

    @Test
    @DisplayName("首尾帧生视频：input_image_asset_id + end_image_asset_id")
    void firstLastFrame() {
        VideoGenSpec spec = new VideoGenSpec("first_last_frame_video", "768p", 2147483647L, "k-a", "k-b", List.of());
        Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", "从白天过渡到夜晚", 15, "21:9", spec,
                new MaterialVideoModelClient.UpstreamInputs(null, "asset_a", "asset_b", List.of()));

        assertEquals(List.of("model", "generationMode", "prompt", "resolutionTier", "orientation", "aspectRatio",
                "outputSizeCode", "seconds", "seed", "input_image_asset_id", "end_image_asset_id"),
                List.copyOf(body.keySet()));
        assertEquals("landscape", body.get("orientation"));
        assertEquals("h3-768-21x9", body.get("outputSizeCode"));
        assertEquals(2147483647L, body.get("seed"));
        assertEquals("asset_a", body.get("input_image_asset_id"));
        assertEquals("asset_b", body.get("end_image_asset_id"));
    }

    @Test
    @DisplayName("全能参考：referenceInputs 逐项 {role, mediaType, assetId}，顺序与提交时一致")
    void universalReference() {
        VideoGenSpec spec = new VideoGenSpec("universal_reference_video", "768p", null, null, null, List.of(
                new VideoGenSpec.Reference("image", "k1"),
                new VideoGenSpec.Reference("video", "k2"),
                new VideoGenSpec.Reference("audio", "k3")));
        Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", "图1的人物穿着图1的衣服跳舞，配音频1", 6, "16:9",
                spec, new MaterialVideoModelClient.UpstreamInputs(null, null, null, List.of(
                        new MaterialVideoModelClient.ReferenceAsset("image", "as_1"),
                        new MaterialVideoModelClient.ReferenceAsset("video", "as_2"),
                        new MaterialVideoModelClient.ReferenceAsset("audio", "as_3"))));

        assertEquals(List.of("model", "generationMode", "prompt", "resolutionTier", "orientation", "aspectRatio",
                "outputSizeCode", "seconds", "referenceInputs"), List.copyOf(body.keySet()));
        assertEquals("""
                [{"role":"reference_image","mediaType":"image","assetId":"as_1"},\
                {"role":"reference_video","mediaType":"video","assetId":"as_2"},\
                {"role":"reference_audio","mediaType":"audio","assetId":"as_3"}]""", json(body.get("referenceInputs")));
        assertFalse(body.containsKey("input_image_asset_id"));
    }

    @Test
    @DisplayName("原生组包照发用户原文：不做短剧那套首帧标记剥离")
    void nativePromptIsSentVerbatim() {
        String prompt = "画面里写着（严格基于该首帧画面延展动态：这几个字）";
        Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", prompt, 5, "9:16",
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()), MaterialVideoModelClient.UpstreamInputs.NONE);
        assertEquals(prompt, body.get("prompt"));
    }

    // ── 老路径：聚算 768p 包逐字段不变 ──────────────────────────────────────

    @Test
    @DisplayName("老路径（画布 / 脚本视频 / 短剧）：横竖屏带上 aspectRatio + outputSizeCode，不然竖屏出成 3:4")
    void legacyJusuanBodyCarriesAspect() {
        Map<String, Object> t2v = client.buildSubmitBody(JUSUAN, "minimax-h3", "雨夜街道", 5, "9:16",
                VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE);
        assertEquals("{\"model\":\"minimax-h3\",\"prompt\":\"雨夜街道\",\"resolutionTier\":\"768p\","
                + "\"orientation\":\"portrait\",\"aspectRatio\":\"9:16\",\"outputSizeCode\":\"h3-768-9x16\","
                + "\"seconds\":5,\"generationMode\":\"t2v\"}", json(t2v));

        Map<String, Object> i2v = client.buildSubmitBody(JUSUAN, "minimax-h3", "让她眨眼", 8, "16:9",
                VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("as_123"));
        assertEquals("{\"model\":\"minimax-h3\",\"prompt\":\"让她眨眼\",\"resolutionTier\":\"768p\","
                + "\"orientation\":\"landscape\",\"aspectRatio\":\"16:9\",\"outputSizeCode\":\"h3-768-16x9\","
                + "\"seconds\":8,\"generationMode\":\"i2v\",\"input_image_asset_id\":\"as_123\"}",
                json(i2v));
    }

    @Test
    @DisplayName("老路径：1:1 / 没给比例 / 合同外的比例仍按原样只发 orientation（square 未实测）")
    void legacyJusuanBodyKeepsOrientationOnlyOutsideContract() {
        for (String ratio : new String[]{"1:1", null, "2:3"}) {
            Map<String, Object> body = client.buildSubmitBody(JUSUAN, "minimax-h3", "雨夜街道", 5, ratio,
                    VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE);
            assertFalse(body.containsKey("aspectRatio"), String.valueOf(ratio));
            assertFalse(body.containsKey("outputSizeCode"), String.valueOf(ratio));
            assertEquals("landscape", body.get("orientation"), String.valueOf(ratio));
        }
    }

    // ── seedance / agnes / 通用协议：首帧 ─────────────────────────────────

    private static final String DRAMA_PROMPT = "镜头推近（严格基于该首帧画面延展动态：https://cdn.x/f.png）"
            + "\n（并以该画面作为结尾帧：https://cdn.x/l.png）";
    private static final String KEY_URL = "https://cdn.test/ipstudio_gen/u1/a.png";

    @Test
    @DisplayName("短剧请求（prompt 里只有首尾帧标记、没有 key）：三种协议的请求体逐字节不变")
    void dramaMarkerOnlyBodiesUnchanged() {
        var none = MaterialVideoModelClient.UpstreamInputs.NONE;
        assertEquals("{\"model\":\"doubao-seedance-1\",\"content\":[{\"type\":\"text\",\"text\":\"镜头推近\"},"
                        + "{\"type\":\"image_url\",\"image_url\":{\"url\":\"https://cdn.x/f.png\"},\"role\":\"first_frame\"},"
                        + "{\"type\":\"image_url\",\"image_url\":{\"url\":\"https://cdn.x/l.png\"},\"role\":\"last_frame\"}],"
                        + "\"ratio\":\"9:16\",\"duration\":5,\"return_last_frame\":true}",
                json(client.buildSubmitBody("seedance", "doubao-seedance-1", DRAMA_PROMPT, 5, "9:16", VideoGenSpec.EMPTY, none)));
        assertEquals("{\"model\":\"agnes-video\",\"prompt\":\"镜头推近\",\"width\":768,\"height\":1152,"
                        + "\"num_frames\":121,\"frame_rate\":24,\"image\":\"https://cdn.x/f.png\"}",
                json(client.buildSubmitBody("agnes", "agnes-video", DRAMA_PROMPT, 5, "9:16", VideoGenSpec.EMPTY, none)));
        assertEquals("{\"model\":\"some-video\",\"prompt\":\"镜头推近\",\"duration\":5,\"aspect_ratio\":\"9:16\","
                        + "\"size\":\"9:16\",\"image\":\"https://cdn.x/f.png\",\"end_image\":\"https://cdn.x/l.png\"}",
                json(client.buildSubmitBody("generic", "some-video", DRAMA_PROMPT, 5, "9:16", VideoGenSpec.EMPTY, none)));
    }

    @Test
    @DisplayName("画布的首帧 key 换成的 URL 进各协议的首帧位：seedance content[first_frame] / agnes image / 通用 image")
    void firstFrameUrlFromKeyFillsEachProtocolsSlot() {
        var spec = VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png");
        var in = MaterialVideoModelClient.UpstreamInputs.firstFrameUrl(KEY_URL);

        assertEquals("{\"model\":\"doubao-seedance-1\",\"content\":[{\"type\":\"text\",\"text\":\"让她眨眼\"},"
                        + "{\"type\":\"image_url\",\"image_url\":{\"url\":\"" + KEY_URL + "\"},\"role\":\"first_frame\"}],"
                        + "\"ratio\":\"9:16\",\"duration\":5,\"return_last_frame\":true}",
                json(client.buildSubmitBody("seedance", "doubao-seedance-1", "让她眨眼", 5, "9:16", spec, in)));
        assertEquals(KEY_URL, client.buildSubmitBody("agnes", "agnes-video", "让她眨眼", 5, "9:16", spec, in).get("image"));
        assertEquals(KEY_URL, client.buildSubmitBody("generic", "some-video", "让她眨眼", 5, "9:16", spec, in).get("image"));
    }

    @Test
    @DisplayName("key 和 prompt 里的首帧标记同时存在：key 赢；尾帧标记照旧")
    void explicitKeyWinsOverMarker() {
        var spec = VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png");
        var in = MaterialVideoModelClient.UpstreamInputs.firstFrameUrl(KEY_URL);

        String seedance = json(client.buildSubmitBody("seedance", "doubao-seedance-1", DRAMA_PROMPT, 5, "9:16", spec, in));
        assertTrue(seedance.contains("{\"url\":\"" + KEY_URL + "\"},\"role\":\"first_frame\""), seedance);
        assertFalse(seedance.contains("https://cdn.x/f.png"), seedance);
        assertTrue(seedance.contains("{\"url\":\"https://cdn.x/l.png\"},\"role\":\"last_frame\""), seedance);

        assertEquals(KEY_URL, client.buildSubmitBody("agnes", "agnes-video", DRAMA_PROMPT, 5, "9:16", spec, in).get("image"));

        Map<String, Object> generic = client.buildSubmitBody("generic", "some-video", DRAMA_PROMPT, 5, "9:16", spec, in);
        assertEquals(KEY_URL, generic.get("image"));
        assertEquals("https://cdn.x/l.png", generic.get("end_image"));
        assertEquals("镜头推近", generic.get("prompt"));
    }

    // ── 协议表达不了的规格：400，不静默丢 ─────────────────────────────────────

    @Test
    @DisplayName("非聚算协议收到任何原生参数 → VIDEO_MODE_UNSUPPORTED；只带首帧 key 放行")
    void nonJusuanRejectsNativeOptions() {
        List<VideoGenSpec> natives = List.of(
                new VideoGenSpec("t2v", "768p", null, null, null, List.of()),
                new VideoGenSpec("i2v", null, null, "k", null, List.of()),
                new VideoGenSpec(null, null, 7L, null, null, List.of()),
                new VideoGenSpec(null, null, null, "k", "k2", List.of()),
                new VideoGenSpec(null, null, null, null, null, List.of(new VideoGenSpec.Reference("image", "k"))));
        for (String protocol : List.of("seedance", "agnes", "generic")) {
            for (VideoGenSpec spec : natives) {
                BusinessException e = assertThrows(BusinessException.class,
                        () -> MaterialVideoModelClient.requireProtocolSupports(protocol, spec, "9:16"));
                assertEquals("VIDEO_MODE_UNSUPPORTED", e.getCode());
            }
            MaterialVideoModelClient.requireProtocolSupports(protocol, VideoGenSpec.firstFrameOnly("k"), "9:16");
            MaterialVideoModelClient.requireProtocolSupports(protocol, VideoGenSpec.EMPTY, "9:16");
        }
    }

    @Test
    @DisplayName("聚算：原生参数缺清晰度、模式 / 比例不在合同里、模式要的素材缺了 → 各自的错误码")
    void jusuanRejectsIncompleteNativeSpecs() {
        assertEquals("VIDEO_MODE_UNSUPPORTED", assertThrows(BusinessException.class,
                () -> MaterialVideoModelClient.requireProtocolSupports(JUSUAN,
                        new VideoGenSpec("i2v", null, null, "k", null, List.of()), "9:16")).getCode());
        assertEquals("VIDEO_STUDIO_MODE_INVALID", assertThrows(BusinessException.class,
                () -> MaterialVideoModelClient.requireProtocolSupports(JUSUAN,
                        new VideoGenSpec("v2v", "768p", null, null, null, List.of()), "9:16")).getCode());
        assertEquals("VIDEO_STUDIO_SPEC_INVALID", assertThrows(BusinessException.class,
                () -> MaterialVideoModelClient.requireProtocolSupports(JUSUAN,
                        new VideoGenSpec("t2v", "768p", null, null, null, List.of()), "2:3")).getCode());
        assertEquals("VIDEO_STUDIO_INPUT_INVALID", assertThrows(BusinessException.class,
                () -> MaterialVideoModelClient.requireProtocolSupports(JUSUAN,
                        new VideoGenSpec("first_last_frame_video", "768p", null, "k", null, List.of()), "9:16")).getCode());
        assertEquals("VIDEO_STUDIO_INPUT_INVALID", assertThrows(BusinessException.class,
                () -> MaterialVideoModelClient.requireProtocolSupports(JUSUAN,
                        new VideoGenSpec("universal_reference_video", "768p", null, null, null, List.of()), "9:16")).getCode());
        // 老路径（无清晰度、只带首帧 key）照常
        MaterialVideoModelClient.requireProtocolSupports(JUSUAN, VideoGenSpec.firstFrameOnly("k"), "9:16");
    }

    // ── 上游拒绝时给用户看的话 ──────────────────────────────────────────────

    @Test
    @DisplayName("创建被拒：4xx 直出厂商原话（截断、脱敏），5xx 只给状态码，非 JSON 不外泄")
    void submitFailureMessages() {
        String m400 = MaterialVideoModelClient.submitFailureMessage(400,
                "{\"error\":{\"code\":\"INVALID_ARGUMENT\",\"message\":\"orientation must be landscape or portrait\"}}");
        assertTrue(m400.contains("orientation must be landscape or portrait"), m400);
        assertFalse(m400.contains("稍后重试"), m400);

        String html = MaterialVideoModelClient.submitFailureMessage(404, "<html><body>nginx 404</body></html>");
        assertFalse(html.contains("nginx"), html);
        assertFalse(html.contains("<"), html);

        String m503 = MaterialVideoModelClient.submitFailureMessage(503, "{\"message\":\"upstream overloaded\"}");
        assertTrue(m503.contains("503"), m503);
        assertFalse(m503.contains("overloaded"), m503);

        String longMsg = "x ".repeat(400);
        String truncated = MaterialVideoModelClient.submitFailureMessage(422, "{\"message\":\"" + longMsg + "\"}");
        assertTrue(truncated.length() < 260, truncated);

        String leaked = MaterialVideoModelClient.submitFailureMessage(401,
                "{\"message\":\"invalid key sk-abcdefghijklmnopqrstuvwxyz0123456789 for Bearer tok123\"}");
        assertFalse(leaked.contains("abcdefghijklmnopqrstuvwxyz0123456789"), leaked);
        assertFalse(leaked.contains("tok123"), leaked);
    }

    @Test
    @DisplayName("轮询到 failed：读聚算的 error.message（对象）/ errorMessage，都没有才退到 errorCode")
    void failReasonReadsJusuanShapes() throws Exception {
        assertEquals("prompt rejected by safety", MaterialVideoModelClient.extractFailReason(om.readTree(
                "{\"status\":\"failed\",\"error\":{\"code\":\"CONTENT_POLICY\",\"message\":\"prompt rejected by safety\"}}")));
        assertEquals("asset expired", MaterialVideoModelClient.extractFailReason(om.readTree(
                "{\"status\":\"failed\",\"errorCode\":\"ASSET_EXPIRED\",\"errorMessage\":\"asset expired\"}")));
        assertEquals("ASSET_EXPIRED", MaterialVideoModelClient.extractFailReason(om.readTree(
                "{\"status\":\"failed\",\"errorCode\":\"ASSET_EXPIRED\"}")));
        assertEquals("CONTENT_POLICY", MaterialVideoModelClient.extractFailReason(om.readTree(
                "{\"status\":\"failed\",\"error\":{\"code\":\"CONTENT_POLICY\"}}")));
        // data 里的说人话原因优先于顶层的错误码
        assertEquals("bad frame", MaterialVideoModelClient.extractFailReason(om.readTree(
                "{\"errorCode\":\"E1\",\"data\":{\"error\":{\"message\":\"bad frame\"}}}")));
    }
}
