package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** worker 唯一的 variant_config 解析入口（docs/video-studio-plan.md §5.2）。 */
class VideoGenSpecTest {

    @Test
    @DisplayName("视频生成区写的完整 JSON：模式 / 清晰度 / 种子 / 首尾帧 / 参考素材（保持顺序）")
    void parsesFullStudioConfig() {
        VideoGenSpec spec = VideoGenSpec.fromVariantConfigJson("""
            {"endpoint_id":"ep-h3","generation_mode":"universal_reference_video","resolution_tier":"544p",
             "seed":42,"first_frame_key":"k-first","last_frame_key":"k-last",
             "reference_inputs":[{"media_type":"image","key":"k1"},{"media_type":"audio","key":"k2"},
                                 {"media_type":"image","key":"k3"}]}""");

        assertEquals("universal_reference_video", spec.generationMode());
        assertEquals("544p", spec.resolutionTier());
        assertEquals(42L, spec.seed());
        assertEquals("k-first", spec.firstFrameKey());
        assertEquals("k-last", spec.lastFrameKey());
        assertEquals(List.of(new VideoGenSpec.Reference("image", "k1"), new VideoGenSpec.Reference("audio", "k2"),
                new VideoGenSpec.Reference("image", "k3")), spec.references());
        assertTrue(spec.isExplicit());
        assertTrue(spec.hasNativeOptions());
    }

    @Test
    @DisplayName("画布的老 JSON（只有 first_frame_key / endpoint_id）→ 老路径，不算原生参数")
    void parsesLegacyCanvasConfig() {
        VideoGenSpec spec = VideoGenSpec.fromVariantConfigJson(
                "{\"endpoint_id\":\"ep-1\",\"first_frame_key\":\"ipstudio_gen/u1/a.png\"}");

        assertEquals(VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"), spec);
        assertNull(spec.generationMode());
        assertNull(spec.resolutionTier());
        assertFalse(spec.isExplicit());
        assertFalse(spec.hasNativeOptions());
    }

    @Test
    @DisplayName("空 / 不是 JSON / 不是对象 → EMPTY（与此前「读不出首帧就当文生视频」一致）")
    void blankOrInvalidIsEmpty() {
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson(null));
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson(""));
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson("   "));
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson("{not json"));
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson("[1,2]"));
        // 短剧 / 带货的 variant_config 里只有它们自己的键 → 同样是 EMPTY
        assertEquals(VideoGenSpec.EMPTY, VideoGenSpec.fromVariantConfigJson(
                "{\"target\":\"shot\",\"scene_id\":\"s1\",\"character\":\"human-001\",\"endpoint_id\":\"ep\"}"));
    }

    @Test
    @DisplayName("空白字段当没有；种子只认整数")
    void blanksAndBadSeedAreDropped() {
        VideoGenSpec spec = VideoGenSpec.fromVariantConfigJson(
                "{\"first_frame_key\":\"  \",\"generation_mode\":\"\",\"seed\":\"abc\"}");
        assertEquals(VideoGenSpec.EMPTY, spec);
        assertEquals(7L, VideoGenSpec.fromVariantConfigJson("{\"seed\":\"7\"}").seed());
        assertNull(VideoGenSpec.fromVariantConfigJson("{\"seed\":1.5}").seed());
    }

    @Test
    @DisplayName("writeTo 与 fromVariantConfig 是同一组键名：写出去读回来一模一样")
    void writeThenParseRoundTrips() {
        VideoGenSpec spec = new VideoGenSpec("first_last_frame_video", "768p", 0L, "k-a", "k-b", List.of());
        ObjectNode vc = new ObjectMapper().createObjectNode();
        spec.writeTo(vc);
        assertEquals(spec, VideoGenSpec.fromVariantConfig(vc));
        assertFalse(vc.has("reference_inputs"));

        VideoGenSpec refs = new VideoGenSpec("universal_reference_video", "768p", null, null, null,
                List.of(new VideoGenSpec.Reference("video", "v1"), new VideoGenSpec.Reference("image", "i1")));
        ObjectNode vc2 = new ObjectMapper().createObjectNode();
        refs.writeTo(vc2);
        assertFalse(vc2.has("seed"));
        assertEquals("video", vc2.path("reference_inputs").get(0).path("media_type").asText());
        assertEquals(refs, VideoGenSpec.fromVariantConfig(vc2));
    }

    @Test
    @DisplayName("参考素材编号：同类按出现顺序数（图1 图2 … 视频1 音频1 …）")
    void referenceLabelsNumberPerType() {
        List<String> labels = VideoGenSpec.referenceLabels(List.of(
                new VideoGenSpec.Reference("image", "a"),
                new VideoGenSpec.Reference("audio", "b"),
                new VideoGenSpec.Reference("image", "c"),
                new VideoGenSpec.Reference("video", "d"),
                new VideoGenSpec.Reference("audio", "e")));
        assertEquals(List.of("图1", "音频1", "图2", "视频1", "音频2"), labels);
    }
}
