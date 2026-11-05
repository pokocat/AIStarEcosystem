package com.aistareco.aep.ipstudio.segmented;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** 分段脚本和审稿拼出来的话：段数、素材编号、格式都在，没有漏填的变量（docs/studio-segmented-video.md）。 */
class SegmentedPromptTest {
    private final StudioSceneCatalog catalog = new StudioSceneCatalog();

    private String sceneId() { return catalog.builtIn().video().get(0).id(); }

    private StudioSceneCatalog.ComposeRequest compose(String text, List<String> images, String character, String voice) {
        return new StudioSceneCatalog.ComposeRequest("video-script", sceneId(), text, null, null, images, character, voice, null, 60, "9:16", "中文", null, Map.of(), null, null, true, null);
    }

    private static final List<Map<String, Object>> SEGMENTS = List.of(Map.of("no", 1, "seconds", 30, "shotsLo", 6, "shotsHi", 8), Map.of("no", 2, "seconds", 30, "shotsLo", 6, "shotsHi", 8));

    @Test void theScriptPromptNamesTheSegmentsAndTheMaterials() {
        var out = catalog.segmentedScript(compose("探店锅盔，原价19现价9.9", List.of("门头.jpg"), "达人.jpg", "配音.mp3"), SEGMENTS, false, false, true, null);
        assertThat(out.user()).contains("写一条 60 秒的竖屏").contains("第1段：30 秒，6–8 个镜头").contains("第2段：30 秒，6–8 个镜头");
        assertThat(out.user()).contains("我的要求：探店锅盔，原价19现价9.9").contains("图1「门头.jpg」").contains("图2「达人.jpg」").contains("「配音.mp3」是说话要用的声音");
        assertThat(out.system()).contains("\"segments\"").contains("\"assets\"").contains("\"dialogue\"");
        assertThat(out.user() + out.system()).doesNotContain("{{");
    }

    @Test void anAdoptedScriptIsSplitWithoutChangingIt() {
        var out = catalog.segmentedScript(compose("第1镜（0–3 秒）：小夏说：「好吃」", List.of("商品.jpg"), null, null), SEGMENTS, true, false, false, null);
        assertThat(out.user()).contains("内容、顺序和台词不改").contains("第1镜（0–3 秒）").doesNotContain("我的要求：");
    }

    @Test void aFirstFrameModelGetsOneShotPerSegment() {
        var out = catalog.segmentedScript(compose("探店", List.of("商品.jpg"), null, null), SEGMENTS, false, true, false, null);
        assertThat(out.user()).contains("每段只有 1 个镜头").doesNotContain("单个镜头 2 到 6 秒");
    }

    @Test void theReviewGetsTheScriptTheIssuesAndTheOutputWithChanges() {
        var out = catalog.segmentedReview(compose("探店", List.of(), null, null), SEGMENTS, List.of("第 1 段第 2 镜 3 秒有 20 个字，念不完"), "{\"segments\":[]}", null);
        assertThat(out.user()).contains("程序查出的问题，必须改掉").contains("- 第 1 段第 2 镜 3 秒有 20 个字，念不完").contains("{\"segments\":[]}").contains("客户的要求：探店");
        assertThat(out.system()).contains("\"changes\"").contains("总导演");
        assertThat(out.user() + out.system()).doesNotContain("{{");
        var clean = catalog.segmentedReview(compose("探店", List.of(), null, null), SEGMENTS, List.of(), "{}", null);
        assertThat(clean.user()).doesNotContain("程序查出的问题");
    }
}
