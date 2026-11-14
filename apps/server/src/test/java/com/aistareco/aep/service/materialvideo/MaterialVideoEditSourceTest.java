package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioEditSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 元素替换的「编辑原视频」（2026-11-12）：端点的全能参考模式配了 edit，视频规格带 editSource，Seedance 协议才组编辑包
 * （火山方舟 Seedance 2.5：omni_reference_task_type=edit、ratio=adaptive、duration=-1）；没配就明确拒绝，不退回普通参考生成。
 */
class MaterialVideoEditSourceTest {
    private final ObjectMapper om = new ObjectMapper();
    private final MaterialVideoModelClient client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
    private static final VideoStudioEditSpec SEEDANCE_25 = new VideoStudioEditSpec(4, 30, true, Map.of("omni_reference_task_type", "edit"));

    /** H3 那份合同，只把全能参考模式换成带 edit 的（null = 不配）。 */
    static AiVideoRequestSpec seedance(VideoStudioEditSpec edit) {
        var base = VideoStudioService.contract(4, 30);
        var modes = new ArrayList<VideoStudioModeSpec>();
        for (var m : base.modes())
            modes.add("universal_reference_video".equals(m.mode())
                    ? new VideoStudioModeSpec(m.mode(), false, false, null, m.references(), null, null, edit) : m);
        return new AiVideoRequestSpec("seedance", new VideoStudioContract(modes, base.tiers(), 4, 30, base.promptMaxChars(), base.seedMax()),
                "/api/v3/contents/generations/tasks", "/api/v3/contents/generations/tasks/{id}", Map.of());
    }
    static String tier(AiVideoRequestSpec spec) {return spec.contract().tiers().get(0).tier();}
    static VideoGenSpec reference(String tier, boolean withVideo) {
        var refs = new ArrayList<VideoGenSpec.Reference>();
        if (withVideo) refs.add(new VideoGenSpec.Reference("video", "owner/clip.mp4"));
        refs.add(new VideoGenSpec.Reference("image", "owner/cup.png"));
        return new VideoGenSpec("universal_reference_video", tier, null, null, null, refs);
    }
    static MaterialVideoModelClient.UpstreamInputs urls() {
        return new MaterialVideoModelClient.UpstreamInputs(null, null, null, List.of(
                new MaterialVideoModelClient.ReferenceAsset("video", "https://media.example/clip.mp4"),
                new MaterialVideoModelClient.ReferenceAsset("image", "https://media.example/cup.png")));
    }

    @Test
    @DisplayName("编辑原视频：画幅和时长跟原视频走（adaptive / -1），带上配置的编辑任务字段，素材照常")
    void editSendsTheEditTaskWithSourceGeometry() throws Exception {
        var configured = seedance(SEEDANCE_25);
        var spec = reference(tier(configured), true).withEditSource();
        MaterialVideoModelClient.requireProtocolSupports("seedance", spec, "9:16", configured);
        var body = om.valueToTree(client.buildSubmitBody("seedance", "seedance-2.5", "编辑视频：以视频1为基础，把杯子替换成图1的保温杯。",
                14, "9:16", spec, urls(), configured, "req-1"));
        assertEquals("adaptive", body.path("ratio").asText());
        assertEquals(-1, body.path("duration").asInt());
        assertEquals("edit", body.path("omni_reference_task_type").asText());
        assertEquals("reference_video", body.path("content").get(1).path("role").asText());
        assertEquals("reference_image", body.path("content").get(2).path("role").asText());
    }

    @Test
    void oneTokenEditSendsExplicitGeometryAndRejectsSeparateAudio() {
        var configured = seedance(new VideoStudioEditSpec(4, 30, false, Map.of("omni_reference_task_type", "edit"), false, 1));
        var tier = tier(configured);
        var spec = reference(tier, true).withEditSource();
        MaterialVideoModelClient.requireProtocolSupports("seedance", spec, "16:9", configured);
        var body = om.valueToTree(client.buildSubmitBody("seedance", "seedance-2.5", "编辑视频：替换方块颜色，保留原声。",
                30, "16:9", spec, urls(), configured, "req-1"));
        assertEquals("16:9", body.path("ratio").asText());
        assertEquals(30, body.path("duration").asInt());
        assertEquals("edit", body.path("omni_reference_task_type").asText());
        var mixed = new VideoGenSpec(spec.generationMode(), tier, null, null, null, List.of(
                new VideoGenSpec.Reference("video", "owner/clip.mp4"),
                new VideoGenSpec.Reference("audio", "owner/voice.wav"))).withEditSource();
        assertEquals("VIDEO_STUDIO_INPUT_INVALID", assertThrows(BusinessException.class, () -> MaterialVideoModelClient
                .requireProtocolSupports("seedance", mixed, "16:9", configured)).getCode());
    }

    @Test
    void preserveSourceSoundIsFrozenAndProviderAudioIsDisabled() {
        var configured = seedance(new VideoStudioEditSpec(4, 30, false,
                Map.of("omni_reference_task_type", "edit", "generate_audio", true), false, 1));
        var spec = reference(tier(configured), true).withEditSource().withSourceAudio();
        var snapshot = om.createObjectNode();
        spec.writeTo(snapshot);
        var restored = VideoGenSpec.fromVariantConfig(snapshot);
        assertTrue(restored.preservesSourceAudio());
        assertEquals(Boolean.FALSE, client.buildSubmitBody("seedance", "seedance-2.5", "编辑视频",
                30, "16:9", restored, urls(), configured).get("generate_audio"));
    }

    @Test
    @DisplayName("同一个端点不带编辑标记：照普通参考生成发页面选的画幅和秒数，不带编辑字段")
    void plainReferenceKeepsRequestedGeometry() throws Exception {
        var configured = seedance(SEEDANCE_25);
        var body = om.valueToTree(client.buildSubmitBody("seedance", "seedance-2.5", "照视频1拍", 14, "9:16",
                reference(tier(configured), true), urls(), configured, "req-1"));
        assertEquals("9:16", body.path("ratio").asText());
        assertEquals(14, body.path("duration").asInt());
        assertFalse(body.has("omni_reference_task_type"));
    }

    @Test
    @DisplayName("没配编辑的模型、别的协议、没有参考视频：带编辑标记一律拒绝，不悄悄退回普通参考生成")
    void editIsRefusedWhereItCannotBeExpressed() {
        var plain = seedance(null);
        assertEquals("VIDEO_MODE_UNSUPPORTED", assertThrows(BusinessException.class, () -> MaterialVideoModelClient
                .requireProtocolSupports("seedance", reference(tier(plain), true).withEditSource(), "9:16", plain)).getCode());
        var configured = seedance(SEEDANCE_25);
        assertEquals("VIDEO_MODE_UNSUPPORTED", assertThrows(BusinessException.class, () -> MaterialVideoModelClient
                .requireProtocolSupports("seedance", reference(tier(configured), false).withEditSource(), "9:16", configured)).getCode());
        assertEquals("VIDEO_MODE_UNSUPPORTED", assertThrows(BusinessException.class, () -> MaterialVideoModelClient
                .requireProtocolSupports("jusuan-media", reference(tier(configured), true).withEditSource(), "9:16", configured)).getCode());
    }

    @Test
    @DisplayName("编辑标记随任务存取：写进 variant_config、读回来还在；改提示词优化不丢它；普通规格不写这个键")
    void editSourceRoundTripsThroughVariantConfig() {
        var spec = reference("768p", true).withEditSource().withOptimizePrompt(false);
        var vc = om.createObjectNode();
        spec.writeTo(vc);
        assertTrue(vc.path(VideoGenSpec.KEY_EDIT_SOURCE).asBoolean());
        var back = VideoGenSpec.fromVariantConfig(vc);
        assertTrue(back.edits());
        assertTrue(back.hasNativeOptions());
        var plainVc = om.createObjectNode();
        reference("768p", true).writeTo(plainVc);
        assertFalse(plainVc.has(VideoGenSpec.KEY_EDIT_SOURCE));
    }

    @Test
    @DisplayName("后台规格：编辑只能配在能带参考视频的 Seedance 模式上，附加字段不能是协议保留字段")
    void specValidatesTheEditBlock() {
        AiVideoRequestSpec.read(seedance(SEEDANCE_25).json());
        assertThrows(RuntimeException.class, () -> seedance(new VideoStudioEditSpec(4, 30, true, Map.of("ratio", "adaptive"))).validate());
        assertThrows(RuntimeException.class, () -> seedance(new VideoStudioEditSpec(10, 4, true, Map.of())).validate());
        var base = VideoStudioService.contract(4, 30);
        var t2v = new VideoStudioModeSpec("t2v", false, false, null, null, null, null, SEEDANCE_25);
        assertThrows(RuntimeException.class, () -> new AiVideoRequestSpec("seedance", new VideoStudioContract(List.of(t2v), base.tiers(), 4, 30,
                base.promptMaxChars(), base.seedMax()), "/tasks", "/tasks/{id}", Map.of()).validate());
    }
}
