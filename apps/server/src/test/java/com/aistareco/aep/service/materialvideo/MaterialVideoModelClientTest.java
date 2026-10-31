package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

/**
 * 视频大模型响应解析的多形态兜底（normalizeStatus / extractVideoUrl / extractProgressPct）。
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
        assertEquals("succeeded", MaterialVideoModelClient.normalizeStatus("ready"));
        // 失败类
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("FAIL"));         // 智谱
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("failed"));
        assertEquals("failed", MaterialVideoModelClient.normalizeStatus("error"));
        // 进行中（含未知 / null 兜底为 processing，避免误判为失败）
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("PROCESSING"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("RUNNING"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("queued"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus("in_progress"));
        assertEquals("processing", MaterialVideoModelClient.normalizeStatus(null));
    }

    @Test
    void extractFailReason_picks_common_vendor_fields() {
        // 不同字段保留可行动的失败原因；供应商账号配额遵循主线的公开错误策略。
        assertEquals("敏感内容拦截",
                MaterialVideoModelClient.extractFailReason(json("{\"task_status\":\"failed\",\"fail_reason\":\"敏感内容拦截\"}")));
        assertEquals("生成服务暂时不可用，请稍后再试或联系平台处理。",
                MaterialVideoModelClient.extractFailReason(json("{\"status\":\"error\",\"message\":\"quota exceeded\"}")));
        assertEquals("bad prompt",
                MaterialVideoModelClient.extractFailReason(json("{\"data\":{\"error\":\"bad prompt\"}}")));
        // 没有任何原因字段 → null（worker 退化为只报 status）
        assertNull(MaterialVideoModelClient.extractFailReason(json("{\"task_status\":\"failed\"}")));
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
    void extractVideoUrl_agnes_shape() {
        assertEquals("https://storage.googleapis.com/agnes/video.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("""
                    {"status":"completed","remixed_from_video_id":"https://storage.googleapis.com/agnes/video.mp4"}
                    """)));
        assertEquals("https://storage.googleapis.com/agnes/data-video.mp4",
                MaterialVideoModelClient.extractVideoUrl(json("""
                    {"data":{"status":"completed","remixed_from_video_id":"https://storage.googleapis.com/agnes/data-video.mp4"}}
                    """)));
    }

    @Test
    void extractVideoUrl_returns_null_when_not_ready() {
        // 进行中：还没有成片 URL
        assertNull(MaterialVideoModelClient.extractVideoUrl(json("{\"task_status\":\"PROCESSING\"}")));
    }

    @Test
    void extractProgressPct_accepts_common_shapes() {
        assertEquals(42, MaterialVideoModelClient.extractProgressPct(json("{\"progress\":0.42}")));
        assertEquals(55, MaterialVideoModelClient.extractProgressPct(json("{\"data\":{\"progress_pct\":55}}")));
        assertEquals(66, MaterialVideoModelClient.extractProgressPct(json("{\"output\":{\"percentage\":\"66%\"}}")));
        assertEquals(73, MaterialVideoModelClient.extractProgressPct(json("{\"progressPct\":\"73\"}")));
    }

    @Test
    void extractProgressPct_clamps_and_ignores_invalid_values() {
        assertEquals(100, MaterialVideoModelClient.extractProgressPct(json("{\"percent\":120}")));
        assertEquals(1, MaterialVideoModelClient.extractProgressPct(json("{\"percent\":\"0.5%\"}")));
        assertNull(MaterialVideoModelClient.extractProgressPct(json("{\"progress\":\"almost\"}")));
        assertNull(MaterialVideoModelClient.extractProgressPct(json("{\"task_status\":\"PROCESSING\"}")));
    }

    @Test
    void normalizeFrames_matches_agnes_rule() {
        assertEquals(121, MaterialVideoModelClient.normalizeFrames(120));
        assertEquals(145, MaterialVideoModelClient.normalizeFrames(144));
        assertEquals(441, MaterialVideoModelClient.normalizeFrames(2000));
    }

    @Test
    void dimensionsForAspect_maps_vertical_short_video() {
        MaterialVideoModelClient.Dimensions d = MaterialVideoModelClient.dimensionsForAspect("9:16");
        assertEquals(720, d.width());
        assertEquals(1280, d.height());
    }

    @Test
    void jusuan_protocol_builds_controlled_768p_request() {
        MaterialVideoModelClient client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("jusuan-media", "minimax-h3",
                "雨夜街道上的电影感推镜", 5, "9:16", VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE);
        assertEquals("minimax-h3", body.get("model"));
        assertEquals("雨夜街道上的电影感推镜", body.get("prompt"));
        assertEquals("768p", body.get("resolutionTier"));
        assertEquals("portrait", body.get("orientation"));
        assertEquals(5, body.get("seconds"));
        assertEquals("t2v", body.get("generationMode"));
    }

    @Test
    void jusuan_protocol_detects_endpoint_and_rejects_out_of_range_duration() {
        AiModelEndpoint endpoint = AiModelEndpoint.builder()
                .name("MiniMax H3")
                .baseUrl("https://api.jusuanhub.com:10443/v1")
                .build();
        assertEquals("jusuan-media", MaterialVideoModelClient.protocolFor(endpoint, "minimax-h3"));
        assertEquals("landscape", MaterialVideoModelClient.orientationForAspect("16:9"));
        assertEquals(15, MaterialVideoModelClient.requireJusuanDuration(15));
        assertThrows(BusinessException.class, () -> MaterialVideoModelClient.requireJusuanDuration(4));
        assertThrows(BusinessException.class, () -> MaterialVideoModelClient.requireJusuanDuration(16));
    }

    @Test
    void extractOutputAssetId_accepts_protected_job_shapes() {
        assertEquals("asset_video_1", MaterialVideoModelClient.extractOutputAssetId(
                json("{\"output_asset_id\":\"asset_video_1\"}")));
        assertEquals("asset_video_2", MaterialVideoModelClient.extractOutputAssetId(
                json("{\"data\":{\"output\":\"ignored\",\"asset_id\":\"asset_video_2\"}}")));
        assertEquals("asset_video_3", MaterialVideoModelClient.extractOutputAssetId(
                json("{\"output_assets\":[{\"id\":\"asset_video_3\"}]}")));
        assertEquals("asset_video_h3", MaterialVideoModelClient.extractOutputAssetId(
                json("{\"assets\":[{\"assetId\":\"asset_video_h3\",\"assetRole\":\"output\"}]}")));
    }

    @Test
    void resolveCreditCostOverride_expands_per_second_candidate() {
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);
        AiModelEndpoint endpoint = AiModelEndpoint.builder().id("h3").billingMode(AiModelBillingMode.PER_SECOND).build();
        AiAppEndpointCandidate candidate = AiAppEndpointCandidate.builder().creditCostOverride(40L).build();
        when(invocation.resolveAcceptedEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), eq("h3"), eq("celebrity")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, candidate, true)));
        MaterialVideoModelClient client = new MaterialVideoModelClient(invocation, new MaterialVideoProperties(), null, null, null);

        assertEquals(600L, client.resolveCreditCostOverride("h3", 15));
    }

    // ── v0.132：时长策略（协议硬边界 ∩ candidate.maxDurationSec，hold 前收口） ──────

    private MaterialVideoModelClient clientWith(AiModelEndpoint endpoint, AiAppEndpointCandidate candidate) {
        AiModelInvocationService invocation = mock(AiModelInvocationService.class);
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION)))
                .thenReturn(Optional.of(endpoint));
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, candidate, true)));
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION),
                org.mockito.ArgumentMatchers.<String>nullable(String.class), eq("celebrity")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, candidate, true)));
        when(invocation.resolveAcceptedEndpoint(eq(AiModelPurpose.VIDEO_GENERATION),
                org.mockito.ArgumentMatchers.<String>nullable(String.class), eq("celebrity")))
                .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, candidate, true)));
        when(invocation.resolveDefaultEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), eq("celebrity")))
                .thenReturn(Optional.of(endpoint));
        return new MaterialVideoModelClient(invocation, new MaterialVideoProperties(), null, null, null);
    }

    private static AiModelEndpoint genericEndpoint() {
        return AiModelEndpoint.builder()
                .id("ep-generic").name("通用视频").baseUrl("https://vendor.example/v1").model("some-video")
                .upstreamApiKeyEncrypted(com.aistareco.common.AepCryptoUtil.encrypt("sk-test"))
                .build();
    }

    @Test
    void protocolDurationBounds_by_protocol() {
        MaterialVideoModelClient client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var jusuan = client.protocolDurationBounds(AiModelEndpoint.builder()
                .name("MiniMax H3").baseUrl("https://api.jusuanhub.com:10443/v1").model("minimax-h3").build());
        assertEquals(5, jusuan.minSec());
        assertEquals(15, jusuan.maxSec());
        var agnes = client.protocolDurationBounds(AiModelEndpoint.builder()
                .name("Agnes").baseUrl("https://agnes.example/v1").model("agnes-video").build());
        assertNull(agnes.minSec()); // 未知下限不臆造
        assertEquals(18, agnes.maxSec()); // 441 帧 / 24fps
        var generic = client.protocolDurationBounds(genericEndpoint());
        assertNull(generic.minSec());
        assertNull(generic.maxSec());
    }

    @Test
    void intersect_candidate_cap_tightens_protocol_bounds() {
        var protocol = new MaterialVideoModelClient.DurationBounds(5, 15);
        assertEquals(10, MaterialVideoModelClient.intersect(protocol,
                AiAppEndpointCandidate.builder().maxDurationSec(10).build()).maxSec());
        // candidate 配得比协议宽 → 协议赢（admin 把 H3 配成 60 也不放行 60）
        assertEquals(15, MaterialVideoModelClient.intersect(protocol,
                AiAppEndpointCandidate.builder().maxDurationSec(60).build()).maxSec());
        // capability 未配置 → 只剩协议边界
        assertEquals(15, MaterialVideoModelClient.intersect(protocol, null).maxSec());
        var unbounded = MaterialVideoModelClient.intersect(
                new MaterialVideoModelClient.DurationBounds(null, null), null);
        assertNull(unbounded.maxSec());
    }

    @Test
    void validateRequest_requires_positive_duration() {
        MaterialVideoModelClient client = clientWith(genericEndpoint(), null);
        BusinessException e = assertThrows(BusinessException.class, () -> client.validateRequest(null, 0));
        assertEquals("VIDEO_DURATION_REQUIRED", e.getCode());
    }

    @Test
    void validateRequest_enforces_candidate_cap_on_generic_protocol() {
        // v0.131 前 capability.maxDurationSec 在带货线是死字段：generic/seedance 端点超限照样过闸。
        MaterialVideoModelClient client = clientWith(genericEndpoint(),
                AiAppEndpointCandidate.builder().maxDurationSec(10).build());
        BusinessException e = assertThrows(BusinessException.class, () -> client.validateRequest(null, 38));
        assertEquals("VIDEO_DURATION_UNSUPPORTED", e.getCode());
        client.validateRequest(null, 10); // 上限内放行
    }

    @Test
    void validateRequest_without_capability_keeps_legacy_leniency() {
        MaterialVideoModelClient client = clientWith(genericEndpoint(), null);
        client.validateRequest(null, 120); // 无协议边界也无 capability → 放行（legacy 宽松语义）
    }

    @Test
    void jusuan_job_and_asset_routes_include_model_scope() {
        assertEquals("https://api.jusuanhub.com:10443/v1/jobs/job_1?model=minimax-h3",
                MaterialVideoModelClient.jusuanScopedUri(
                        "https://api.jusuanhub.com:10443/v1", "/jobs/job_1", "minimax-h3").toString());
        assertEquals("https://api.jusuanhub.com:10443/v1/assets/asset_1/content?model=minimax-h3",
                MaterialVideoModelClient.jusuanScopedUri(
                        "https://api.jusuanhub.com:10443/v1", "/assets/asset_1/content", "minimax-h3").toString());
    }

    // ── v0.183：聚算 H3 的参考图（i2v）─────────────────────────
    //
    // 用户实测：「生成视频时参考图好像没传过去」。核对聚算 createMediaGeneration 文档后确认 ——
    // 这条链一律发 generationMode=t2v、一张图都没送。聚算的图也不是给 URL：
    // 得先 POST /v1/assets/input?model=… 传上去换 assetId，再放进 input_image_asset_id。

    @Test
    @DisplayName("有首帧 assetId → generationMode=i2v + input_image_asset_id")
    void jusuanBodyCarriesFirstFrameAsset() {
        MaterialVideoModelClient client = new MaterialVideoModelClient(
                null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("jusuan-media", "minimax-h3", "让她眨眼", 8, "9:16",
                VideoGenSpec.firstFrameOnly("ipstudio_gen/u1/a.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("as_123"));
        assertEquals("i2v", body.get("generationMode"));
        assertEquals("as_123", body.get("input_image_asset_id"));
        assertEquals(8, body.get("seconds"));
    }

    @Test
    @DisplayName("2026-09-30 热修：只有聚算协议的首帧要走存储 key，业务线据此决定写不写 first_frame_key")
    void firstFrameNeedsStorageKeyOnlyForJusuan() {
        AiModelEndpoint h3 = AiModelEndpoint.builder()
                .id("h3").name("聚算 JusuanHub · MiniMax H3 视频").baseUrl("https://api.jusuanhub.com:10443/v1")
                .model("minimax-h3").build();
        AiModelEndpoint seedance = AiModelEndpoint.builder()
                .id("sd").name("豆包 Seedance").baseUrl("https://ark.example/api/v3").model("doubao-seedance-pro").build();
        assertEquals(true, clientWith(h3, null).firstFrameNeedsStorageKey("h3"));
        assertEquals(true, clientWith(h3, null).firstFrameNeedsStorageKey(null)); // 默认端点同一判定
        assertEquals(false, clientWith(seedance, null).firstFrameNeedsStorageKey("sd"));
        assertEquals(false, clientWith(genericEndpoint(), null).firstFrameNeedsStorageKey(null));
        // submit 用的就是这一处判定
        assertEquals(true, MaterialVideoModelClient.usesUploadedFirstFrame("jusuan-media"));
        assertEquals(false, MaterialVideoModelClient.usesUploadedFirstFrame("seedance"));
    }

    @Test
    @DisplayName("没有首帧 → 仍是 t2v，且不带 input_image_asset_id（纯文生视频行为不变）")
    void jusuanBodyStaysTextToVideoWithoutReference() {
        MaterialVideoModelClient client = new MaterialVideoModelClient(
                null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("jusuan-media", "minimax-h3", "雨夜街道", 5, "9:16",
                VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE);
        assertEquals("t2v", body.get("generationMode"));
        assertFalse(body.containsKey("input_image_asset_id"));
    }

    @Test
    void configuredSeedanceSupportsNativeStudioModesAndReferenceWire() {
        var configured = new AiVideoRequestSpec("seedance", VideoStudioService.contract(4, 15),
                "/api/v3/contents/generations/tasks", "/api/v3/contents/generations/tasks/{id}",
                java.util.Map.of("generate_audio", true), "/v1/models");
        assertEquals(configured, AiVideoRequestSpec.read(configured.json()));
        var spec = new VideoGenSpec("universal_reference_video", "768p", null, null, null,
                java.util.List.of(new VideoGenSpec.Reference("image", "reference.png")));
        MaterialVideoModelClient.requireProtocolSupports("seedance", spec, "16:9", configured);
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("seedance", "seedance-2.0", "雨夜街道", 8, "16:9", spec,
                new MaterialVideoModelClient.UpstreamInputs(null, null, null,
                        java.util.List.of(new MaterialVideoModelClient.ReferenceAsset("image", "https://cdn.example/ref.png"))));
        var content = (com.fasterxml.jackson.databind.node.ArrayNode) body.get("content");
        assertEquals("reference_image", content.get(1).get("role").asText());
        assertEquals("https://cdn.example/ref.png", content.get(1).get("image_url").get("url").asText());
        assertEquals("768p", body.get("resolution"));
        assertEquals(8, body.get("duration"));
    }

    @Test
    void configuredJusuanUsesItsSavedCanvasAndDurationInsteadOfLegacyH3Table() {
        var legacy = VideoStudioService.contract(5, 15);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                legacy.modes(), java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                "100:71", 10000, 7100, "provider-custom-100x71")))), 20, 30, 7000, 2147483647L);
        var configured = new AiVideoRequestSpec("jusuan-media", contract,
                "/media/generations", "/media/generations/{id}", java.util.Map.of());
        var spec = new VideoGenSpec("t2v", "custom", null, null, null, java.util.List.of());
        MaterialVideoModelClient.requireProtocolSupports("jusuan-media", spec, "100:71", configured);
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("jusuan-media", "custom-model", "雨夜街道", 20, "100:71",
                spec, MaterialVideoModelClient.UpstreamInputs.NONE, configured);
        assertEquals("custom", body.get("resolutionTier"));
        assertEquals("100:71", body.get("aspectRatio"));
        assertEquals("landscape", body.get("orientation"));
        assertEquals("provider-custom-100x71", body.get("outputSizeCode"));
        assertEquals(20, body.get("seconds"));
        var optimized = MaterialVideoModelClient.buildOptimizationBody("request-123", "custom-model",
                "雨夜街道", 20, "100:71", spec, MaterialVideoModelClient.UpstreamInputs.NONE, configured);
        var mediaSpec = (java.util.Map<?, ?>) optimized.get("mediaSpec");
        assertEquals("provider-custom-100x71", mediaSpec.get("outputSizeCode"));
        assertEquals(20, mediaSpec.get("seconds"));
    }

    @Test
    void configuredJusuanLegacyCanvasUsesSavedContractForTextAndFirstFrame() {
        var legacy = VideoStudioService.contract(5, 15);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                legacy.modes(), java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                "100:71", 10000, 7100, "provider-custom-100x71")))), 20, 30, 7000, 2147483647L);
        var configured = new AiVideoRequestSpec("jusuan-media", contract,
                "/media/generations", "/media/generations/{id}", java.util.Map.of());
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var textBody = client.buildSubmitBody("jusuan-media", "custom-model", "雨夜街道", 20, "100:71",
                VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE, configured);
        assertEquals("custom", textBody.get("resolutionTier"));
        assertEquals("provider-custom-100x71", textBody.get("outputSizeCode"));
        assertEquals(20, textBody.get("seconds"));
        assertEquals("t2v", textBody.get("generationMode"));

        var imageBody = client.buildSubmitBody("jusuan-media", "custom-model", "让她眨眼", 25, "100:71",
                VideoGenSpec.firstFrameOnly("local.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("uploaded-asset"), configured);
        assertEquals("i2v", imageBody.get("generationMode"));
        assertEquals("uploaded-asset", imageBody.get("input_image_asset_id"));
        assertEquals("custom", imageBody.get("resolutionTier"));
        assertEquals(25, imageBody.get("seconds"));
        assertThrows(BusinessException.class, () -> client.buildSubmitBody("jusuan-media", "custom-model",
                "雨夜街道", 20, "9:16", VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE, configured));
        assertThrows(BusinessException.class, () -> client.buildSubmitBody("jusuan-media", "custom-model",
                "雨夜街道", 20, "100:71", new VideoGenSpec("i2v", null, null, "local.png", null, java.util.List.of()),
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("uploaded-asset"), configured));
        var textOnly = new AiVideoRequestSpec("jusuan-media",
                new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                        java.util.List.of(legacy.modes().get(0)), contract.tiers(), 20, 30, 7000, 2147483647L),
                "/media/generations", "/media/generations/{id}", java.util.Map.of());
        assertThrows(BusinessException.class, () -> client.buildSubmitBody("jusuan-media", "custom-model",
                "让她眨眼", 25, "100:71", VideoGenSpec.firstFrameOnly("local.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameAsset("uploaded-asset"), textOnly));
    }

    @Test
    void configuredSeedanceLegacyCanvasHonorsOpenModesAndResolution() {
        var legacy = VideoStudioService.contract(4, 15);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                java.util.List.of(legacy.modes().get(0), legacy.modes().get(1)),
                java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                        "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                        "100:71", 1000, 710)))), 4, 15, 2000, 4294967295L);
        var configured = new AiVideoRequestSpec("seedance", contract,
                "/tasks", "/tasks/{id}", java.util.Map.of());
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("seedance", "seedance-model", "让她眨眼", 8, "100:71",
                VideoGenSpec.firstFrameOnly("local.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameUrl("https://example.com/local.png"), configured);
        assertEquals("custom", body.get("resolution"));
        var textOnly = new AiVideoRequestSpec("seedance",
                new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                        java.util.List.of(legacy.modes().get(0)), contract.tiers(), 4, 15, 2000, 4294967295L),
                "/tasks", "/tasks/{id}", java.util.Map.of());
        assertThrows(BusinessException.class, () -> client.buildSubmitBody("seedance", "seedance-model",
                "让她眨眼", 8, "100:71", VideoGenSpec.firstFrameOnly("local.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameUrl("https://example.com/local.png"), textOnly));
    }

    @Test
    void configuredJsonTemplateLegacyTextUsesItsSavedModeAndTemplate() {
        var legacy = VideoStudioService.contract(4, 15);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                java.util.List.of(legacy.modes().get(0)),
                java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                        "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                        "100:71", 1000, 710)))), 4, 15, 2000, 4294967295L);
        var configured = new AiVideoRequestSpec("json-template", contract, "/tasks", "/tasks/{id}",
                java.util.Map.of(), "", null, java.util.Map.of("t2v", java.util.Map.of(
                        "prompt", "${prompt}", "seconds", "${seconds}", "ratio", "${aspectRatio}")));
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var body = client.buildSubmitBody("json-template", "internal-model", "雨夜街道", 8, "100:71",
                VideoGenSpec.EMPTY, MaterialVideoModelClient.UpstreamInputs.NONE, configured);
        assertEquals("雨夜街道", body.get("prompt"));
        assertEquals(8, body.get("seconds"));
        assertEquals("100:71", body.get("ratio"));
        assertThrows(BusinessException.class, () -> client.buildSubmitBody("json-template", "internal-model",
                "雨夜街道", 8, "100:71", VideoGenSpec.firstFrameOnly("local.png"),
                MaterialVideoModelClient.UpstreamInputs.firstFrameUrl("https://example.com/local.png"), configured));
    }

    @Test
    void configuredJusuanUsesItsSavedFrameUploadLimit() {
        var legacy = VideoStudioService.contract(5, 15);
        var frame = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit(
                "image", 1, 24L * 1024 * 1024, java.util.List.of("PNG"), null, null);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec(
                        "i2v", true, false, frame, null)),
                java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                        "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                        "100:71", 10000, 7100, "provider-custom-100x71")))),
                20, 30, legacy.promptMaxChars(), legacy.seedMax());
        var configured = new AiVideoRequestSpec("jusuan-media", contract,
                "/media/generations", "/media/generations/{id}", java.util.Map.of());
        assertEquals(16L * 1024 * 1024,
                MaterialVideoModelClient.materialMaxBytes(null, "i2v", "image", true));
        assertEquals(24L * 1024 * 1024,
                MaterialVideoModelClient.materialMaxBytes(configured, "i2v", "image", true));
        assertEquals(java.util.List.of("PNG", "JPEG", "WEBP"),
                MaterialVideoModelClient.materialFormats(null, "i2v", "image", true));
        assertEquals(java.util.List.of("PNG"),
                MaterialVideoModelClient.materialFormats(configured, "i2v", "image", true));
    }

    @Test
    void acceptedTaskKeepsItsConfiguredPollRouteAfterEndpointEdit() {
        var accepted = new AiVideoRequestSpec("seedance", VideoStudioService.contract(4, 15),
                "/api/v3/contents/generations/tasks", "/api/v3/contents/generations/tasks/{id}",
                java.util.Map.of());
        var endpoint = AiModelEndpoint.builder().baseUrl("https://new.example")
                .videoRequestSpecJson(new AiVideoRequestSpec("seedance", VideoStudioService.contract(4, 15),
                        "/new", "/new/{id}", java.util.Map.of()).json()).build();
        var submitted = new MaterialVideoModelClient.SubmitResult("task-123", null, "OneToken",
                "seedance-2.0", "seedance", "ep-sd", "studio", "https://old.example", accepted.json());
        var client = new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        assertEquals("https://old.example/api/v3/contents/generations/tasks/task-123",
                client.pollUri(endpoint, submitted).toString());
    }

    @Test
    void acceptedTaskCanResumeAfterEndpointIsDisabled() {
        var invocation = mock(AiModelInvocationService.class);
        var endpoint = AiModelEndpoint.builder().id("ep-sd").name("OneToken")
                .baseUrl("https://api.example").model("seedance-2.0").enabled(false).build();
        when(invocation.storedEndpoint("ep-sd")).thenReturn(Optional.of(endpoint));
        var client = new MaterialVideoModelClient(invocation, new MaterialVideoProperties(), null, null, null);

        var resumed = client.resumeExistingTask("task-123", "ep-sd", null, null, "studio",
                "https://accepted.example", null);
        assertEquals("ep-sd", resumed.endpointId());
        assertEquals("https://accepted.example", resumed.baseUrlSnapshot());
        assertEquals("OneToken", resumed.providerUsed());
    }

    @Test
    void recordedLegacySubmissionIgnoresLaterProtocolConfigurationAndDefaultChanges() {
        var invocation=mock(AiModelInvocationService.class);
        var endpoint=AiModelEndpoint.builder().id("original").name("now seedance")
                .baseUrl("https://changed.example").model("changed-model").videoRequestSpecJson("{}").build();
        when(invocation.storedEndpoint("original")).thenReturn(Optional.of(endpoint));
        var client=new MaterialVideoModelClient(invocation,new MaterialVideoProperties(),null,null,null);
        var resumed=client.resumeExistingTask("supplier-original","original","Original supplier","original-model","studio","https://accepted.example","");
        assertEquals("generic",resumed.protocol());assertEquals("original-model",resumed.modelUsed());
        assertEquals("https://accepted.example/async-result/supplier-original",client.pollUri(endpoint,resumed).toString());
    }

    @Test
    @DisplayName("按文件名给出正确的 Content-Type —— 传错类型上游会拒")
    void picksContentTypeByExtension() {
        assertEquals("image/jpeg", MaterialVideoModelClient.contentTypeOf("a.JPG"));
        assertEquals("image/jpeg", MaterialVideoModelClient.contentTypeOf("a.jpeg"));
        assertEquals("image/webp", MaterialVideoModelClient.contentTypeOf("a.webp"));
        assertEquals("image/png", MaterialVideoModelClient.contentTypeOf("a.png"));
        assertEquals("image/png", MaterialVideoModelClient.contentTypeOf(null));
    }

    @Test
    @DisplayName("参考图被上游拒收：4xx 直出厂商原话，5xx 也展示原因，非 JSON 不外泄")
    void surfacesUploadRejectionReason() {
        // 4xx 说的是「我们请求哪儿不对」—— 抹掉它用户就只剩一句「请稍后重试」，而重试永远不会好
        assertEquals("参考图上传失败（上游 400）；model does not accept input assets",
                MaterialVideoModelClient.uploadFailureMessage(
                        "参考图", 400, "{\"error\":{\"message\":\"model does not accept input assets\"}}"));
        assertEquals("参考图上传失败（上游 415）；unsupported image format",
                MaterialVideoModelClient.uploadFailureMessage("参考图", 415, "{\"message\":\"unsupported image format\"}"));
        // 5xx 是厂商自己的问题，用户做不了什么，细节留日志
        assertEquals("参考图上传失败（上游 502）；bad gateway",
                MaterialVideoModelClient.uploadFailureMessage("参考图", 502, "{\"message\":\"bad gateway\"}"));
        // 网关的 HTML 错误页不要糊到界面上
        assertEquals("参考图上传失败（上游 404）",
                MaterialVideoModelClient.uploadFailureMessage("参考图", 404, "<html><body>404 Not Found</body></html>"));
    }

    @Test
    @DisplayName("聚算只出 768p + 横/竖两档 —— 如实告诉前端，别让用户选一个兑现不了的画幅")
    void videoGeometry_reportsWhatTheProtocolCanActuallyProduce() {
        MaterialVideoModelClient client =
                new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);

        AiModelEndpoint jusuan = AiModelEndpoint.builder()
                .name("MiniMax H3").model("minimax-h3")
                .baseUrl("https://api.jusuanhub.com:10443/v1").build();
        var geo = client.videoGeometry(jusuan);
        assertEquals(java.util.List.of("768"), geo.resolutions());
        assertEquals(java.util.List.of("16:9", "9:16"), geo.ratios());

        // 我们自己按比例算宽高的协议不受这层限制 —— 返回 null，前端保留完整选项
        AiModelEndpoint agnes = AiModelEndpoint.builder()
                .name("agnes-video").model("agnes-video").baseUrl("https://agnes.example.com").build();
        assertNull(client.videoGeometry(agnes));
        assertNull(client.videoGeometry(null));
    }

    @Test
    void videoGeometry_usesSavedContractForConfiguredEndpoints() {
        MaterialVideoModelClient client =
                new MaterialVideoModelClient(null, new MaterialVideoProperties(), null, null, null);
        var base = VideoStudioService.contract(4, 15);
        var contract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                base.modes(), java.util.List.of(
                    new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier("720p", java.util.List.of(
                        new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas("3:4", 720, 960))),
                    new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier("cinema", java.util.List.of(
                        new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas("21:9", 1680, 720)))),
                base.minSeconds(), base.maxSeconds(), base.promptMaxChars(), base.seedMax());
        AiModelEndpoint seedance = AiModelEndpoint.builder().model("seedance-2")
                .baseUrl("https://video.example.com")
                .videoRequestSpecJson(new AiVideoRequestSpec("seedance", contract,
                        "/tasks", "/tasks/{id}", java.util.Map.of()).json()).build();

        var geometry = client.videoGeometry(seedance);
        assertEquals(java.util.List.of("720", "cinema"), geometry.resolutions());
        assertEquals(java.util.List.of("3:4", "21:9"), geometry.ratios());

        var jusuanContract = new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract(
                base.modes(), java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier(
                    "custom", java.util.List.of(new com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas(
                        "100:71", 10000, 7100, "vendor-custom")))),
                base.minSeconds(), base.maxSeconds(), base.promptMaxChars(), base.seedMax());
        AiModelEndpoint jusuan = AiModelEndpoint.builder().model("minimax-h3")
                .baseUrl("https://api.jusuanhub.com:10443/v1")
                .videoRequestSpecJson(new AiVideoRequestSpec("jusuan-media", jusuanContract,
                        "/media/generations", "/jobs/{id}", java.util.Map.of()).json()).build();
        var configuredGeometry = client.videoGeometry(jusuan);
        assertEquals(java.util.List.of("custom"), configuredGeometry.resolutions());
        assertEquals(java.util.List.of("100:71"), configuredGeometry.ratios());
    }

    @Test
    @DisplayName("3:4 在聚算那儿必然被吃成 portrait —— 这正是「选 720p·3:4 拿回 768×1376」的由来")
    void orientation_collapsesAspectRatio() {
        assertEquals("portrait", MaterialVideoModelClient.orientationForAspect("3:4"));
        assertEquals("portrait", MaterialVideoModelClient.orientationForAspect("9:16"));
        assertEquals("landscape", MaterialVideoModelClient.orientationForAspect("16:9"));
        assertEquals("landscape", MaterialVideoModelClient.orientationForAspect(null));
    }

    @Test
    @DisplayName("文件名后缀改成真实格式 —— 有的服务端除了 Content-Type 还看文件名")
    void rewritesFilenameExtension() {
        assertEquals("a.jpg", MaterialVideoModelClient.withExtension("a.png", "jpg"));
        assertEquals("x.y.webp", MaterialVideoModelClient.withExtension("x.y.png", "webp"));
        assertEquals("noext.jpg", MaterialVideoModelClient.withExtension("noext", "jpg"));
        assertEquals("reference.png", MaterialVideoModelClient.withExtension(null, "png"));
    }
}
