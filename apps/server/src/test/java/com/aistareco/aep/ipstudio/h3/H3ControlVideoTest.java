package com.aistareco.aep.ipstudio.h3;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 深度复刻交给 H3 的控制视频（2026-11-08，照 ReShot 给 H3 的示例）：视频1 要定义成只迁移动作和机位的主体，
 * 灰色画面 / 火柴人本身不迁移。此前按原文直发「视频1是深度结构视频」，成片把近处的遮挡物画成了半透明白布。
 */
class H3ControlVideoTest {
    static final ObjectMapper OM = new ObjectMapper();
    static final VideoSettings REF = new VideoSettings("universal_reference_video", "768p", null, null, null,
            List.of(new VideoStudioReferenceInput("video", "u/depth.mp4"), new VideoStudioReferenceInput("image", "u/face.png")), null, "auto");

    @Test
    void aDepthControlVideoIsDescribedAsMotionOnly() {
        var built = H3StudioPrompt.build("新人物躺在地毯上换装。", 15, REF, null, Map.of("u/depth.mp4", "depth"));
        String video = built.request().references().get(0);
        assertTrue(video.startsWith("<Video 1>: a grey depth map"), video);
        assertTrue(video.contains("attribute_transfer") && video.contains("grey depth look is not transferred"), video);
        assertEquals("<Picture 1>: reference image.", built.request().references().get(1));
        assertEquals(List.of("<Video 1>"), built.controlVideos());
    }

    @Test
    void aSkeletonControlVideoMustNotAppearInThePicture() {
        String video = H3StudioPrompt.build("跳舞。", 10, REF, null, Map.of("u/depth.mp4", "pose")).request().references().get(0);
        assertTrue(video.startsWith("<Video 1>: an OpenPose skeleton video"), video);
        assertTrue(video.contains("no skeleton lines appear in the picture"), video);
    }

    @Test
    void anOrdinaryReferenceVideoIsUnchanged() {
        var built = H3StudioPrompt.build("照这段拍。", 10, REF, null);
        assertEquals("<Video 1>: reference video.", built.request().references().get(0));
        assertTrue(built.controlVideos().isEmpty());
    }

    private static ObjectNode meta(boolean control) {
        var built = H3StudioPrompt.build("新人物躺在地毯上换装。", 15, REF, null, control ? Map.of("u/depth.mp4", "depth") : Map.of());
        ObjectNode meta = H3PromptRewrite.meta(OM, built.request(), built.pictures(), built.videos(), built.audios());
        if (!built.controlVideos().isEmpty()) built.controlVideos().forEach(meta.putArray("controlVideos")::add);
        return meta;
    }

    private static ObjectNode out(String retention) {
        ObjectNode o = OM.createObjectNode().put("subject_definitions", "<Subject 1> is the woman in <Picture 1>.\n<Subject 2> is the motion in <Video 1>.")
                .put("summary", "[reference generation] She changes outfits.").put("retention_analysis", retention)
                .put("style", "Live-action.").put("overall_soundscape", "Room tone.").put("non_diegetic_music", "N/A");
        o.putArray("shots").add(OM.createObjectNode().put("start", 0).put("text", "A top-down shot of <Subject 1> lying on a rug."));
        return o;
    }

    private static String retention(JsonNode r) {
        String template = r.path("template").asText();
        int at = template.indexOf("retention_analysis");
        return at < 0 ? template : template.substring(at);
    }

    @Test
    void theControlVideoIsNeverKeptAsItsOwnPicture() {
        String full = "<Subject 1> (appears in [Shot 1]): fully_preserved - face.\n<Video 1> (motion): fully_preserved - the depth map is kept.";
        JsonNode r = H3PromptRewrite.validate(OM, meta(true), out(full));
        assertTrue(retention(r).contains("<Video 1> (motion): attribute_transfer - the depth map is kept."), r.path("template").asText());
        assertTrue(r.path("notes").toString().contains("动作参考视频的保留关系已改为只迁移动作"));
        // 不是控制视频的参考视频，模型怎么标就怎么留
        assertTrue(retention(H3PromptRewrite.validate(OM, meta(false), out(full))).contains("<Video 1> (motion): fully_preserved"));
    }

    @Test
    void aMissingControlVideoIsAddedBackAsMotionOnly() {
        ObjectNode o = out("<Subject 1> (appears in [Shot 1]): fully_preserved - face.");
        o.put("subject_definitions", "<Subject 1> is the woman in <Picture 1>.");
        JsonNode r = H3PromptRewrite.validate(OM, meta(true), o);
        assertTrue(r.path("template").asText().contains("<Video 1> is the attached reference: a grey depth map"), r.path("template").asText());
        assertTrue(retention(r).contains("<Video 1>: attribute_transfer"), r.path("template").asText());
    }
}
