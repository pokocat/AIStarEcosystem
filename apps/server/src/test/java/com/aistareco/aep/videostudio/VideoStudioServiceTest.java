package com.aistareco.aep.videostudio;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJob;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.model.StudioTemplate;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.aep.videostudio.repository.StudioTemplateRepository;
import com.aistareco.aep.videostudio.service.VideoStudioPricing;
import com.aistareco.aep.videostudio.service.VideoStudioPricingService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.videostudio.service.VideoStudioTemplateService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.File;
import java.nio.file.Path;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 视频生成区服务（docs/video-studio-plan.md §3–§5、§9、§10）。纯 Mockito：
 * 计价（配置 → 模型每秒价 → 未定价）、模型选择、校验顺序与每一条 400、归属闸（含做同款的模板素材）、
 * 智能优化结果的核对、交给通用视频链的 item（逐字段）、任务出 wire。
 * 断言一律断错误码，不断文案（§8.0.1 ⑩）。
 */
class VideoStudioServiceTest {

    static final String USER = "u1";
    static final String IMG = "video-studio-image/u1/0123456789abcdef0123456789abcdef.png";
    static final String IMG2 = "video-studio-image/u1/1123456789abcdef0123456789abcdef.jpg";
    static final String VID = "video-studio-video/u1/2123456789abcdef0123456789abcdef.mp4";
    static final String AUD = "video-studio-audio/u1/3123456789abcdef0123456789abcdef.mp3";

    /** 别人（模板作者 u9）的素材：只有做同款且在模板里时才用得上。 */
    static final String TPL_FIRST = "video-studio-image/u9/a123456789abcdef0123456789abcdef.png";
    static final String TPL_IMG = "video-studio-image/u9/b123456789abcdef0123456789abcdef.png";
    static final String TPL_AUD = "video-studio-audio/u9/c123456789abcdef0123456789abcdef.mp3";

    private final ObjectMapper om = new ObjectMapper();
    private AiModelInvocationService invocation;
    private MaterialVideoModelClient modelClient;
    private MaterialVideoJobService videoJobs;
    private MaterialVideoJobRepository jobRepo;
    private FileStorageService fileStorage;
    private CdnUrlSigner signer;
    private FfmpegRunner ffmpeg;
    private VideoStudioPricingService pricing;
    private StudioTemplateRepository templateRepo;
    private InAppOperatorGuard operators;
    private StudioPromptOptimizationRepository optimizationRepo;
    private VideoStudioService svc;

    private AiModelEndpoint h3;
    private AiAppEndpointCandidate h3Candidate;

    @BeforeEach
    void setUp() {
        invocation = mock(AiModelInvocationService.class);
        modelClient = mock(MaterialVideoModelClient.class);
        videoJobs = mock(MaterialVideoJobService.class);
        jobRepo = mock(MaterialVideoJobRepository.class);
        fileStorage = mock(FileStorageService.class);
        signer = mock(CdnUrlSigner.class);
        ffmpeg = mock(FfmpegRunner.class);
        pricing = mock(VideoStudioPricingService.class);
        templateRepo = mock(StudioTemplateRepository.class);
        operators = mock(InAppOperatorGuard.class);
        optimizationRepo = mock(StudioPromptOptimizationRepository.class);
        VideoStudioTemplateService templates = new VideoStudioTemplateService(templateRepo, jobRepo, fileStorage, operators, om);
        svc = new VideoStudioService(invocation, modelClient, videoJobs, jobRepo, fileStorage, signer, ffmpeg, om,
                pricing, templates, optimizationRepo);

        h3 = AiModelEndpoint.builder().id("ep-h3").name("MiniMax H3").baseUrl("https://api.jusuanhub.com/v1")
                .model("minimax-h3").billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        h3Candidate = AiAppEndpointCandidate.builder().endpointId("ep-h3").enabled(true).creditCostOverride(40L).build();
        listCandidates(new AiModelInvocationService.ResolvedEndpoint(h3, h3Candidate, true));
        ready(h3);
        when(pricing.current()).thenReturn(VideoStudioPricing.defaults());

        when(videoJobs.submit(any(), eq(USER), eq(MaterialVideoJobService.APP_VIDEO_STUDIO)))
                .thenReturn(List.of(om.createObjectNode().put("id", "mvj_1")));
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(MaterialVideoJob.builder().id("mvj_1").ownerUserId(USER)
                .app(MaterialVideoJobService.APP_VIDEO_STUDIO).status("queued").createdAt(OffsetDateTime.now()).build()));
        when(fileStorage.signedUrl(anyString())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=1");
        when(signer.maybeSign(anyString())).thenAnswer(i -> i.getArgument(0) + "?signed=1");
    }

    private void listCandidates(AiModelInvocationService.ResolvedEndpoint... rows) {
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of(rows));
    }

    private void ready(AiModelEndpoint ep) {
        when(modelClient.isEndpointReady(ep)).thenReturn(true);
        when(modelClient.isJusuanMedia(ep)).thenReturn(true);
        when(modelClient.protocolDurationBounds(ep)).thenReturn(new MaterialVideoModelClient.DurationBounds(5, 15));
    }

    /** 后台计价配置：cells = 「模式:清晰度 → 每秒价」，没写的格子为 null。 */
    private void config(Map<String, Long> cells, int freeRefImages, long extraPerSecond, long optimizationPerCall) {
        Map<String, Map<String, Long>> perSecond = new LinkedHashMap<>();
        cells.forEach((k, v) -> perSecond.computeIfAbsent(k.split(":")[0], m -> new LinkedHashMap<>()).put(k.split(":")[1], v));
        when(pricing.current()).thenReturn(VideoStudioPricing.validate(
                new VideoStudioPricingConfig(perSecond, freeRefImages, extraPerSecond, optimizationPerCall)));
    }

    @Test void canvasUsesOwnAssetsWithSharedNativeValidationAndPriceWithoutSubmitting() {
        var keys=new ArrayList<String>();
        var prepared=svc.prepareCanvas(USER,jr("ep-h3","first_last_frame_video","过渡","544p","3:4",7,42L,
                "ipstudio/u1/first.png","ipstudio/u1/last.png",List.of()),(type,key)->keys.add(type+":"+key));
        assertEquals(List.of("image:ipstudio/u1/first.png","image:ipstudio/u1/last.png"),keys);
        assertEquals(280,prepared.credits());
        assertEquals("ipstudio/u1/last.png",prepared.spec().lastFrameKey());
        assertEquals("544p",prepared.spec().resolutionTier());
        verify(videoJobs,never()).submit(any(),anyString(),anyString());
    }
    @Test void canvasDoesNotBypassUnsupportedModelMissingTailOrOwnerRejection() {
        assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED",assertThrows(BusinessException.class,()->svc.prepareCanvas(USER,
            jr("wrong","t2v","x","768p","9:16",5,null,null,null,List.of()),(type,key)->{})).getCode());
        assertThrows(BusinessException.class,()->svc.prepareCanvas(USER,
            jr("ep-h3","first_last_frame_video","x","768p","9:16",5,null,IMG,null,List.of()),(type,key)->{}));
        assertEquals("IP_ASSET_KEY_INVALID",assertThrows(BusinessException.class,()->svc.prepareCanvas(USER,
            jr("ep-h3","i2v","x","768p","9:16",5,null,IMG,null,List.of()),(type,key)->{throw BusinessException.badRequest("IP_ASSET_KEY_INVALID","wrong owner");})).getCode());
        verify(videoJobs,never()).submit(any(),anyString(),anyString());
    }

    // ── 请求构造 ──────────────────────────────────────────────────────────

    static VideoStudioJobRequest jr(String endpointId, String mode, String prompt, String tier, String aspect,
                                    Integer seconds, Long seed, String first, String last,
                                    List<VideoStudioReferenceInput> refs) {
        return new VideoStudioJobRequest(endpointId, mode, prompt, tier, aspect, seconds, seed, first, last, refs, null, null);
    }

    static VideoStudioJobRequest t2v() {
        return jr(null, "t2v", "一只猫在窗台上打盹", "768p", "9:16", 5, null, null, null, null);
    }

    static VideoStudioJobRequest with(VideoStudioJobRequest r, String field, Object value) {
        return new VideoStudioJobRequest(
                "endpointId".equals(field) ? (String) value : r.endpointId(),
                "mode".equals(field) ? (String) value : r.mode(),
                "prompt".equals(field) ? (String) value : r.prompt(),
                "resolutionTier".equals(field) ? (String) value : r.resolutionTier(),
                "aspectRatio".equals(field) ? (String) value : r.aspectRatio(),
                "seconds".equals(field) ? (Integer) value : r.seconds(),
                "seed".equals(field) ? (Long) value : r.seed(),
                "firstFrameKey".equals(field) ? (String) value : r.firstFrameKey(),
                "lastFrameKey".equals(field) ? (String) value : r.lastFrameKey(),
                "references".equals(field) ? castRefs(value) : r.references(),
                "templateId".equals(field) ? (String) value : r.templateId(),
                "optimizationId".equals(field) ? (String) value : r.optimizationId());
    }

    @SuppressWarnings("unchecked")
    private static List<VideoStudioReferenceInput> castRefs(Object v) {
        return (List<VideoStudioReferenceInput>) v;
    }

    static VideoStudioJobRequest ref(List<VideoStudioReferenceInput> refs) {
        return jr(null, "universal_reference_video", "图1在跳舞", "768p", "9:16", 5, null, null, null, refs);
    }

    static VideoStudioReferenceInput r(String type, String key) {
        return new VideoStudioReferenceInput(type, key);
    }

    static List<VideoStudioReferenceInput> images(int n) {
        return new ArrayList<>(IntStream.range(0, n)
                .mapToObj(i -> r("image", "video-studio-image/u1/" + String.format("%032x", i) + ".png")).toList());
    }

    private String code(VideoStudioJobRequest req) {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submit(USER, req));
        verify(videoJobs, never()).submit(any(), any(), any());
        return e.getCode();
    }

    private JsonNode submittedItem(VideoStudioJobRequest req) {
        svc.submit(USER, req);
        ArgumentCaptor<JsonNode> body = ArgumentCaptor.forClass(JsonNode.class);
        verify(videoJobs).submit(body.capture(), eq(USER), eq(MaterialVideoJobService.APP_VIDEO_STUDIO));
        assertEquals(1, body.getValue().path("items").size());
        return body.getValue().path("items").get(0);
    }

    /** 模板作者 u9 的模板：首帧图 + 一张参考图 + 一段参考音频。 */
    private StudioTemplate template(String id, String scope, String owner, String status) throws Exception {
        var recipe = new VideoStudioTemplateService.TemplateRecipe("universal_reference_video", "原作提示词", "768p", "9:16",
                5, 7L, "ep-h3", "MiniMax H3", List.of(
                new VideoStudioTemplateService.TemplateRecipe.Material("first_frame", "image", TPL_FIRST, "首帧"),
                new VideoStudioTemplateService.TemplateRecipe.Material("reference", "image", TPL_IMG, "图1"),
                new VideoStudioTemplateService.TemplateRecipe.Material("reference", "audio", TPL_AUD, "音频1")));
        StudioTemplate t = StudioTemplate.builder().id(id).ownerUserId(owner).scope(scope).status(status)
                .title("模板").sourceJobId("mvj_src").recipeJson(om.writeValueAsString(recipe))
                .createdAt(Instant.now()).build();
        when(templateRepo.findById(id)).thenReturn(Optional.of(t));
        return t;
    }

    // ── 模型列表 + 计价 ─────────────────────────────────────────────────────

    @Nested
    class Models {

        @Test
        @DisplayName("默认配置（全空）：每一格都回落到模型的每秒价；合同来自 H3")
        void defaultConfigFallsBackToModelRate() {
            List<VideoStudioModel> models = svc.listModels();
            assertEquals(1, models.size());
            VideoStudioModel m = models.get(0);
            assertEquals("ep-h3", m.endpointId());
            assertEquals("MiniMax H3", m.name());
            assertTrue(m.isDefault());
            assertTrue(m.selectableById());
            for (String mode : List.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video")) {
                assertEquals(Map.of("768p", 40L, "544p", 40L), m.pricing().perSecond().get(mode), mode);
            }
            assertEquals(0, m.pricing().freeRefImages());
            assertEquals(0L, m.pricing().extraRefImagePerSecond());
            assertEquals(0L, m.pricing().promptOptimizationPerCall());

            assertEquals(List.of("t2v", "i2v", "first_last_frame_video", "universal_reference_video"),
                    m.contract().modes().stream().map(s -> s.mode()).toList());
            assertEquals(List.of("768p", "544p"), m.contract().tiers().stream().map(t -> t.tier()).toList());
            assertEquals(5, m.contract().minSeconds());
            assertEquals(15, m.contract().maxSeconds());
            assertEquals(7000, m.contract().promptMaxChars());
            assertEquals(2147483647L, m.contract().seedMax());
            var refRules = m.contract().modes().get(3).references();
            assertEquals(9, refRules.image().maxCount());
            assertEquals(8, refRules.maxImagesWithVideo());
            assertEquals(12, refRules.maxTotal());
            assertEquals(2, refRules.audio().minDurationSec());
            assertEquals(15, refRules.maxAudioTotalSec());
            assertEquals(16L * 1024 * 1024, m.contract().modes().get(1).frameImage().maxBytes());
        }

        @Test
        @DisplayName("配置的格子优先于模型每秒价；空格子仍回落；加价与优化单价照配置下发")
        void configCellsOverrideModelRate() {
            config(Map.of("t2v:768p", 50L, "universal_reference_video:544p", 15L), 6, 10L, 5L);
            VideoStudioModel m = svc.listModels().get(0);
            assertEquals(50L, m.pricing().perSecond().get("t2v").get("768p"));
            assertEquals(40L, m.pricing().perSecond().get("t2v").get("544p"));
            assertEquals(15L, m.pricing().perSecond().get("universal_reference_video").get("544p"));
            assertEquals(6, m.pricing().freeRefImages());
            assertEquals(10L, m.pricing().extraRefImagePerSecond());
            assertEquals(5L, m.pricing().promptOptimizationPerCall());
        }

        @Test
        @DisplayName("模型没配每秒价（没 override / 端点按次计费）且配置也空着 → 未定价（null），不回落任何写死的价")
        void noModelRateAndEmptyCellIsUnpriced() {
            h3Candidate.setCreditCostOverride(null);
            VideoStudioModel m = svc.listModels().get(0);
            assertNull(m.pricing().perSecond().get("t2v").get("768p"));

            h3Candidate.setCreditCostOverride(25L);
            h3.setBillingMode(AiModelBillingMode.PER_CALL);
            assertNull(svc.listModels().get(0).pricing().perSecond().get("i2v").get("544p"));

            config(Map.of("i2v:544p", 30L), 0, 0L, 0L);
            assertEquals(30L, svc.listModels().get(0).pricing().perSecond().get("i2v").get("544p"));
        }

        @Test
        @DisplayName("模型每秒价填成 0 算「没定价」而不是「免费」：格子要求 ≥ 1，回落路也同一个口径")
        void zeroModelRateIsUnpricedNotFree() {
            h3Candidate.setCreditCostOverride(0L);
            VideoStudioModel m = svc.listModels().get(0);
            assertNull(m.pricing().perSecond().get("t2v").get("768p"));
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", code(t2v()));
        }

        @Test
        @DisplayName("没有候选行时合成默认项：selectableById=false；它没有模型每秒价，只认配置")
        void synthesizedDefault() {
            listCandidates();
            when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null))
                    .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(h3, null, true)));
            VideoStudioModel m = svc.listModels().get(0);
            assertFalse(m.selectableById());
            assertTrue(m.isDefault());
            assertNull(m.pricing().perSecond().get("t2v").get("768p"));
        }

        @Test
        @DisplayName("默认端点的候选被后台停用：不再合成默认项（否则等于绕过停用）")
        void disabledDefaultCandidateIsNotResurrected() {
            h3Candidate.setEnabled(false);
            listCandidates(new AiModelInvocationService.ResolvedEndpoint(h3, h3Candidate, true));
            when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null))
                    .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(h3, h3Candidate, true)));
            assertTrue(svc.listModels().isEmpty());
            assertEquals("VIDEO_NOT_CONFIGURED", code(t2v()));
        }

        @Test
        @DisplayName("只列聚算媒体协议、启用且可提交的端点；候选的最长时长收紧区间，区间为空的不列")
        void filtersAndDurationBounds() {
            AiModelEndpoint seedance = AiModelEndpoint.builder().id("ep-sd").name("Seedance").baseUrl("https://ark/api/v3")
                    .enabled(true).build();
            AiAppEndpointCandidate sdCandidate = AiAppEndpointCandidate.builder().endpointId("ep-sd").enabled(true).build();
            when(modelClient.isEndpointReady(seedance)).thenReturn(true);
            when(modelClient.isJusuanMedia(seedance)).thenReturn(false);
            AiModelEndpoint off = AiModelEndpoint.builder().id("ep-off").name("停用").enabled(false).build();
            AiAppEndpointCandidate offCandidate = AiAppEndpointCandidate.builder().endpointId("ep-off").enabled(true).build();
            h3Candidate.setMaxDurationSec(10);
            listCandidates(new AiModelInvocationService.ResolvedEndpoint(h3, h3Candidate, true),
                    new AiModelInvocationService.ResolvedEndpoint(seedance, sdCandidate, false),
                    new AiModelInvocationService.ResolvedEndpoint(off, offCandidate, false));

            List<VideoStudioModel> models = svc.listModels();
            assertEquals(List.of("ep-h3"), models.stream().map(VideoStudioModel::endpointId).toList());
            assertEquals(10, models.get(0).contract().maxSeconds());

            h3Candidate.setMaxDurationSec(3);
            assertTrue(svc.listModels().isEmpty());
        }
    }

    // ── 提交：交给通用视频链的 item ─────────────────────────────────────────

    @Nested
    class SubmittedItem {

        @Test
        @DisplayName("文生视频 768p × 5 秒 = 40 × 5 = 200 积分；item 与 variant_config 逐字段")
        void textToVideoItem() {
            JsonNode item = submittedItem(with(t2v(), "prompt", "  一只猫在窗台上打盹 \n"));
            assertEquals("文生视频 · 768p · 9:16 · 5 秒", item.path("name").asText());
            assertEquals("studio-t2v", item.path("kind").asText());
            assertEquals("一只猫在窗台上打盹", item.path("prompt").asText());
            assertEquals(5, item.path("duration_sec").asInt());
            assertEquals("9:16", item.path("aspect_ratio").asText());
            assertEquals(200L, item.path("credit_cost").asLong());
            assertEquals("视频生成", item.path("credit_label").asText());
            assertEquals("{\"endpoint_id\":\"ep-h3\",\"generation_mode\":\"t2v\",\"resolution_tier\":\"768p\"}",
                    item.path("variant_config").toString());
        }

        @Test
        @DisplayName("配置把 544p 定成 20/秒：544p × 5 秒 = 100 积分")
        void configured544Price() {
            config(Map.of("t2v:544p", 20L), 0, 0L, 0L);
            assertEquals(100L, submittedItem(with(t2v(), "resolutionTier", "544p")).path("credit_cost").asLong());
        }

        @Test
        @DisplayName("全能参考 8 张图，前 6 张免费、之后每张每秒 +10：(40 + 2×10) × 5 = 300；reference_inputs 保持提交顺序")
        void referencePriceWithExtraImages() {
            config(Map.of(), 6, 10L, 0L);
            List<VideoStudioReferenceInput> refs = images(8);
            JsonNode item = submittedItem(ref(refs));
            assertEquals(300L, item.path("credit_cost").asLong());
            assertEquals("studio-ref", item.path("kind").asText());
            JsonNode vc = item.path("variant_config");
            assertEquals("universal_reference_video", vc.path("generation_mode").asText());
            assertEquals(8, vc.path("reference_inputs").size());
            for (int i = 0; i < 8; i++) {
                assertEquals("image", vc.path("reference_inputs").get(i).path("media_type").asText());
                assertEquals(refs.get(i).key(), vc.path("reference_inputs").get(i).path("key").asText());
            }
            assertFalse(vc.has("first_frame_key"));
        }

        @Test
        @DisplayName("加价只算全能参考：首帧生视频不受免费张数 / 加价影响")
        void extraOnlyForReferenceMode() {
            config(Map.of(), 0, 10L, 0L);
            JsonNode item = submittedItem(with(with(t2v(), "mode", "i2v"), "firstFrameKey", IMG));
            assertEquals(200L, item.path("credit_cost").asLong());
        }

        @Test
        @DisplayName("所选模式 × 清晰度没定价（配置空着、模型也没每秒价）→ 503 VIDEO_STUDIO_PRICE_NOT_CONFIGURED，不冻结")
        void unpricedCellIs503() {
            h3Candidate.setCreditCostOverride(null);
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", code(t2v()));
        }

        @Test
        @DisplayName("首尾帧 + 种子：first_frame_key / last_frame_key / seed 进 variant_config")
        void firstLastFrameWithSeed() {
            VideoStudioJobRequest req = jr("ep-h3", "first_last_frame_video", "从白天到夜晚", "768p",
                    "16:9", 10, 42L, IMG, IMG2, null);
            JsonNode item = submittedItem(req);
            assertEquals("首尾帧生视频 · 768p · 16:9 · 10 秒", item.path("name").asText());
            assertEquals("studio-flf", item.path("kind").asText());
            assertEquals(400L, item.path("credit_cost").asLong());
            assertEquals("{\"endpoint_id\":\"ep-h3\",\"generation_mode\":\"first_last_frame_video\",\"resolution_tier\":\"768p\","
                    + "\"seed\":42,\"first_frame_key\":\"" + IMG + "\",\"last_frame_key\":\"" + IMG2 + "\"}",
                    item.path("variant_config").toString());
        }

        @Test
        @DisplayName("合成的默认项：variant_config 不写 endpoint_id；价格只能来自配置")
        void synthesizedDefaultOmitsEndpointId() {
            listCandidates();
            when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null))
                    .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(h3, null, true)));
            config(Map.of("t2v:544p", 30L), 0, 0L, 0L);
            JsonNode item = submittedItem(with(t2v(), "resolutionTier", "544p"));
            assertFalse(item.path("variant_config").has("endpoint_id"));
            assertEquals(150L, item.path("credit_cost").asLong());
        }

        @Test
        @DisplayName("单价离谱到乘法溢出 → VIDEO_PRICE_OVERFLOW，不冻结")
        void priceOverflow() {
            h3Candidate.setCreditCostOverride(Long.MAX_VALUE / 2);
            assertEquals("VIDEO_PRICE_OVERFLOW", code(t2v()));
        }

        @Test
        @DisplayName("返回的是按落库任务组的 DTO")
        void returnsPersistedJob() {
            VideoStudioJob job = svc.submit(USER, t2v());
            assertEquals("mvj_1", job.id());
            assertEquals("queued", job.status());
        }
    }

    // ── 提交：智能优化的结果 ────────────────────────────────────────────────

    @Nested
    class OptimizationResult {

        private void optimization(String id, String owner, String status) {
            when(optimizationRepo.findById(id)).thenReturn(Optional.of(StudioPromptOptimization.builder()
                    .id(id).ownerUserId(owner).clientRequestId("crid-0001").status(status)
                    .specJson("{}").originalPrompt("一只猫").optimizedPrompt("一只橘猫在洒满阳光的窗台上打盹，镜头缓慢推近")
                    .build()));
        }

        @Test
        @DisplayName("带本人成功的 optimizationId：送去生成的是请求里的最终文本，variant_config 记 optimization_id + 原提示词")
        void recordsOriginalPrompt() {
            optimization("vso_1", USER, StudioPromptOptimization.STATUS_SUCCEEDED);
            JsonNode item = submittedItem(with(with(t2v(), "prompt", "一只橘猫打盹（我改过）"), "optimizationId", "vso_1"));
            assertEquals("一只橘猫打盹（我改过）", item.path("prompt").asText());
            assertEquals("vso_1", item.path("variant_config").path("optimization_id").asText());
            assertEquals("一只猫", item.path("variant_config").path("original_prompt").asText());
        }

        @Test
        @DisplayName("optimizationId 不是本人的 / 还没成功 / 不存在 → 400 VIDEO_STUDIO_OPTIMIZATION_INVALID，不冻结")
        void rejectsUnusableOptimization() {
            optimization("vso_other", "u2", StudioPromptOptimization.STATUS_SUCCEEDED);
            assertEquals("VIDEO_STUDIO_OPTIMIZATION_INVALID", code(with(t2v(), "optimizationId", "vso_other")));
            optimization("vso_run", USER, StudioPromptOptimization.STATUS_RUNNING);
            assertEquals("VIDEO_STUDIO_OPTIMIZATION_INVALID", code(with(t2v(), "optimizationId", "vso_run")));
            optimization("vso_fail", USER, StudioPromptOptimization.STATUS_FAILED);
            assertEquals("VIDEO_STUDIO_OPTIMIZATION_INVALID", code(with(t2v(), "optimizationId", "vso_fail")));
            assertEquals("VIDEO_STUDIO_OPTIMIZATION_INVALID", code(with(t2v(), "optimizationId", "vso_missing")));
        }

        @Test
        @DisplayName("优化记录不要求与生成时的模式 / 规格一致（优化完可以再改）")
        void specMayDifferFromOptimization() {
            optimization("vso_1", USER, StudioPromptOptimization.STATUS_SUCCEEDED);
            submittedItem(with(with(with(t2v(), "resolutionTier", "544p"), "aspectRatio", "1:1"), "optimizationId", "vso_1"));
        }
    }

    // ── 提交：做同款 ────────────────────────────────────────────────────────

    @Nested
    class SameAsTemplate {

        @Test
        @DisplayName("官方模板的原素材可以原样带回（类型一致），template_id 进 variant_config，建出任务后 use_count +1")
        void templateMaterialsAreAccepted() throws Exception {
            template("vst_1", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_ACTIVE);
            VideoStudioJobRequest req = with(ref(List.of(r("image", TPL_IMG), r("audio", TPL_AUD), r("image", IMG))),
                    "templateId", "vst_1");
            JsonNode item = submittedItem(req);
            assertEquals("vst_1", item.path("variant_config").path("template_id").asText());
            assertEquals(TPL_IMG, item.path("variant_config").path("reference_inputs").get(0).path("key").asText());
            verify(templateRepo).incrementUseCount("vst_1");
        }

        @Test
        @DisplayName("模板首帧图可以当首帧用；自己的私有模板也能做同款")
        void privateTemplateOfOwnerWorks() throws Exception {
            template("vst_mine", StudioTemplate.SCOPE_PRIVATE, USER, StudioTemplate.STATUS_ACTIVE);
            submittedItem(with(with(with(t2v(), "mode", "i2v"), "firstFrameKey", TPL_FIRST), "templateId", "vst_mine"));
            verify(templateRepo).incrementUseCount("vst_mine");
        }

        @Test
        @DisplayName("模板看不到（别人的私有 / 已下架 / 不存在）→ 404 VIDEO_STUDIO_TEMPLATE_NOT_FOUND，不冻结、不计数")
        void invisibleTemplateIs404() throws Exception {
            template("vst_priv", StudioTemplate.SCOPE_PRIVATE, "u9", StudioTemplate.STATUS_ACTIVE);
            assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(with(ref(List.of(r("image", TPL_IMG))), "templateId", "vst_priv")));
            template("vst_gone", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_WITHDRAWN);
            assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(with(ref(List.of(r("image", TPL_IMG))), "templateId", "vst_gone")));
            assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(with(t2v(), "templateId", "vst_nope")));
            verify(templateRepo, never()).incrementUseCount(anyString());
        }

        @Test
        @DisplayName("模板素材只认这个模板、且类型一致：不带 templateId、换了别的模板、图当音频用 → VIDEO_STUDIO_ASSET_INVALID")
        void templateKeysOnlyForThatTemplateAndType() throws Exception {
            template("vst_1", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_ACTIVE);
            StudioTemplate other = StudioTemplate.builder().id("vst_2").ownerUserId("u8").scope(StudioTemplate.SCOPE_OFFICIAL)
                    .status(StudioTemplate.STATUS_ACTIVE).title("另一个").sourceJobId("x")
                    .recipeJson(om.writeValueAsString(new VideoStudioTemplateService.TemplateRecipe("t2v", "p", "768p",
                            "9:16", 5, null, null, null, List.of()))).createdAt(Instant.now()).build();
            when(templateRepo.findById("vst_2")).thenReturn(Optional.of(other));

            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(ref(List.of(r("image", TPL_IMG)))));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(ref(List.of(r("image", TPL_IMG))), "templateId", "vst_2")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID",
                    code(with(ref(List.of(r("image", IMG), r("audio", TPL_IMG))), "templateId", "vst_1")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID",
                    code(with(with(with(t2v(), "mode", "i2v"), "firstFrameKey", TPL_AUD), "templateId", "vst_1")));
            verify(templateRepo, never()).incrementUseCount(anyString());
        }
    }

    // ── 提交：校验 ──────────────────────────────────────────────────────────

    @Nested
    class Validation {

        @Test
        @DisplayName("模型：不在列表 / 合成默认项却带了编号 / 省略编号但没有默认项 → VIDEO_STUDIO_MODEL_UNSUPPORTED；一个模型都没有 → VIDEO_NOT_CONFIGURED")
        void modelChecks() {
            assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED", code(with(t2v(), "endpointId", "ep-other")));

            listCandidates(new AiModelInvocationService.ResolvedEndpoint(h3, h3Candidate, false));
            assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED", code(t2v()));

            listCandidates();
            when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null))
                    .thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(h3, null, true)));
            assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED", code(with(t2v(), "endpointId", "ep-h3")));

            when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null)).thenReturn(Optional.empty());
            assertEquals("VIDEO_NOT_CONFIGURED", code(t2v()));
        }

        @Test
        @DisplayName("校验顺序：模型先于模式，模式先于提示词，提示词先于规格，规格先于素材，素材先于价格")
        void validationOrder() {
            h3Candidate.setCreditCostOverride(null);   // 价格未定价：只有走到最后一步才会报
            assertEquals("VIDEO_STUDIO_MODEL_UNSUPPORTED",
                    code(jr("nope", "v2v", "", "1080p", "2:3", 99, -1L, "x", "y", null)));
            assertEquals("VIDEO_STUDIO_MODE_INVALID",
                    code(jr(null, "v2v", "", "1080p", "2:3", 99, -1L, "x", "y", null)));
            assertEquals("VIDEO_STUDIO_PROMPT_REQUIRED",
                    code(jr(null, "t2v", "", "1080p", "2:3", 99, -1L, "x", "y", null)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID",
                    code(jr(null, "t2v", "p", "1080p", "2:3", 99, -1L, "x", "y", null)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID",
                    code(jr(null, "t2v", "p", "768p", "9:16", 5, 1L, "x", "y", null)));
            assertEquals("VIDEO_STUDIO_PRICE_NOT_CONFIGURED", code(t2v()));
        }

        @Test
        @DisplayName("模式不是四种之一 → VIDEO_STUDIO_MODE_INVALID")
        void modeInvalid() {
            assertEquals("VIDEO_STUDIO_MODE_INVALID", code(with(t2v(), "mode", null)));
            assertEquals("VIDEO_STUDIO_MODE_INVALID", code(with(t2v(), "mode", "T2V")));
            assertEquals("VIDEO_STUDIO_MODE_INVALID", code(with(t2v(), "mode", "video_to_video")));
        }

        @Test
        @DisplayName("提示词：去首尾空白（含不换行空格）后为空 → REQUIRED；超过 7000 个字符（按 Unicode 字符数）→ TOO_LONG")
        void promptChecks() {
            assertEquals("VIDEO_STUDIO_PROMPT_REQUIRED", code(with(t2v(), "prompt", null)));
            assertEquals("VIDEO_STUDIO_PROMPT_REQUIRED", code(with(t2v(), "prompt", " \n\t 　﻿ ")));
            assertEquals("VIDEO_STUDIO_PROMPT_TOO_LONG", code(with(t2v(), "prompt", "猫".repeat(7001))));
        }

        @Test
        @DisplayName("恰好 7000 个字符放行：表情符号（代理对）按一个字算")
        void promptAtLimitPasses() {
            String prompt = "😀".repeat(7000);   // 14000 个 char，7000 个 code point
            assertEquals(prompt, submittedItem(with(t2v(), "prompt", prompt)).path("prompt").asText());
        }

        @Test
        @DisplayName("规格：清晰度 / 比例不在合同内、时长缺失或越界（含候选收紧的上限）、种子越界 → VIDEO_STUDIO_SPEC_INVALID")
        void specChecks() {
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "resolutionTier", "1080p")));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "resolutionTier", null)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "aspectRatio", "2:3")));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seconds", null)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seconds", 4)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seconds", 16)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seed", -1L)));
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seed", 2147483648L)));
            h3Candidate.setMaxDurationSec(10);
            assertEquals("VIDEO_STUDIO_SPEC_INVALID", code(with(t2v(), "seconds", 11)));
        }

        @Test
        @DisplayName("种子边界 0 放行")
        void seedBoundsPass() {
            assertEquals(0L, submittedItem(with(t2v(), "seed", 0L)).path("variant_config").path("seed").asLong());
        }

        @Test
        @DisplayName("种子上限放行")
        void seedMaxPasses() {
            assertEquals(2147483647L,
                    submittedItem(with(t2v(), "seed", 2147483647L)).path("variant_config").path("seed").asLong());
        }

        @Test
        @DisplayName("素材与模式不匹配 → VIDEO_STUDIO_INPUT_INVALID（每一条）")
        void inputChecksPerMode() {
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(t2v(), "firstFrameKey", IMG)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(t2v(), "lastFrameKey", IMG)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(t2v(), "references", List.of(r("image", IMG)))));
            VideoStudioJobRequest i2v = with(t2v(), "mode", "i2v");
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(i2v));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(i2v, "firstFrameKey", "   ")));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(with(i2v, "firstFrameKey", IMG), "lastFrameKey", IMG2)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID",
                    code(with(with(i2v, "firstFrameKey", IMG), "references", List.of(r("image", IMG2)))));
            VideoStudioJobRequest flf = with(with(t2v(), "mode", "first_last_frame_video"), "firstFrameKey", IMG);
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(flf));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(ref(List.of(r("image", IMG))), "firstFrameKey", IMG2)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(with(ref(List.of(r("image", IMG))), "lastFrameKey", IMG2)));
        }

        @Test
        @DisplayName("全能参考的组合限制 → VIDEO_STUDIO_INPUT_INVALID：空、超 12、类型不对、没上传完、重复、超张数、有视频时图 >8、没有视觉素材")
        void referenceRules() {
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(null)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of())));
            List<VideoStudioReferenceInput> thirteen = images(9);
            thirteen.add(r("video", VID));
            thirteen.add(r("audio", AUD));
            thirteen.add(r("audio", "video-studio-audio/u1/4123456789abcdef0123456789abcdef.mp3"));
            thirteen.add(r("audio", "video-studio-audio/u1/5123456789abcdef0123456789abcdef.mp3"));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(thirteen)));
            List<VideoStudioReferenceInput> withNull = new ArrayList<>();
            withNull.add(null);
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(withNull)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("document", IMG)))));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("image", " ")))));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("image", IMG), r("image", IMG)))));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(images(10))));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("video", VID),
                    r("video", "video-studio-video/u1/6123456789abcdef0123456789abcdef.mp4")))));
            List<VideoStudioReferenceInput> fourAudios = new ArrayList<>(List.of(r("image", IMG)));
            for (int i = 0; i < 4; i++) fourAudios.add(r("audio", "video-studio-audio/u1/" + String.format("%032x", i) + ".mp3"));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(fourAudios)));
            List<VideoStudioReferenceInput> nineWithVideo = images(9);
            nineWithVideo.add(r("video", VID));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(nineWithVideo)));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("audio", AUD)))));
        }

        @Test
        @DisplayName("有视频时 8 张图放行（上限在 8，不在 9）")
        void eightImagesWithVideoPass() {
            List<VideoStudioReferenceInput> refs = images(8);
            refs.add(r("video", VID));
            JsonNode item = submittedItem(ref(refs));
            assertEquals(9, item.path("variant_config").path("reference_inputs").size());
        }

        @Test
        @DisplayName("两段以上音频：重新探时长，加起来超过 15 秒 → VIDEO_STUDIO_INPUT_INVALID；读不出来 → VIDEO_STUDIO_ASSET_INVALID")
        void audioTotal() throws Exception {
            String aud2 = "video-studio-audio/u1/4123456789abcdef0123456789abcdef.wav";
            when(fileStorage.openForRead(AUD)).thenReturn(Path.of("/tmp/a.mp3"));
            when(fileStorage.openForRead(aud2)).thenReturn(Path.of("/tmp/b.wav"));
            when(ffmpeg.probeMedia(new File("/tmp/a.mp3")))
                    .thenReturn(new FfmpegRunner.MediaProbe(8.0, "mp3", null, "mp3", 0, 0, 44100, 2, true));
            when(ffmpeg.probeMedia(new File("/tmp/b.wav")))
                    .thenReturn(new FfmpegRunner.MediaProbe(7.5, "wav", null, "pcm_s16le", 0, 0, 44100, 2, true));
            assertEquals("VIDEO_STUDIO_INPUT_INVALID", code(ref(List.of(r("image", IMG), r("audio", AUD), r("audio", aud2)))));

            when(ffmpeg.probeMedia(new File("/tmp/b.wav")))
                    .thenReturn(new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(ref(List.of(r("image", IMG), r("audio", AUD), r("audio", aud2)))));
        }

        @Test
        @DisplayName("两段音频加起来正好 15 秒放行")
        void audioTotalAtLimitPasses() throws Exception {
            String aud2 = "video-studio-audio/u1/4123456789abcdef0123456789abcdef.wav";
            when(fileStorage.openForRead(AUD)).thenReturn(Path.of("/tmp/a.mp3"));
            when(fileStorage.openForRead(aud2)).thenReturn(Path.of("/tmp/b.wav"));
            when(ffmpeg.probeMedia(any(File.class)))
                    .thenReturn(new FfmpegRunner.MediaProbe(7.5, "mp3", null, "mp3", 0, 0, 44100, 2, true));
            submittedItem(ref(List.of(r("image", IMG), r("audio", AUD), r("audio", aud2))));
        }

        @Test
        @DisplayName("只有一段音频：上传时已验过 2–15 秒，提交时不再读文件")
        void singleAudioIsNotProbed() throws Exception {
            submittedItem(ref(List.of(r("image", IMG), r("audio", AUD))));
            verify(fileStorage, never()).openForRead(anyString());
        }
    }

    // ── 归属闸 ──────────────────────────────────────────────────────────────

    @Nested
    class Ownership {

        @Test
        @DisplayName("别人的 key、类型对不上的 key、带 .. 的 key、前缀后面还有目录的 key → VIDEO_STUDIO_ASSET_INVALID")
        void keysMustBeOwnAndOfTheDeclaredType() {
            VideoStudioJobRequest i2v = with(t2v(), "mode", "i2v");
            assertEquals("VIDEO_STUDIO_ASSET_INVALID",
                    code(with(i2v, "firstFrameKey", "video-studio-image/u2/0123456789abcdef0123456789abcdef.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", VID)));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "video-studio-image/u1/../u2/x.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "video-studio-image/u1/sub/x.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "video-studio-image/u1/")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "ipstudio_gen/u1/a.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "/video-studio-image/u1/a.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(with(i2v, "firstFrameKey", "video-studio-image\\u1\\a.png")));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(ref(List.of(r("image", IMG), r("audio", VID)))));
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(ref(List.of(r("video", IMG)))));
            VideoStudioJobRequest flf = jr(null, "first_last_frame_video", "p", "768p", "9:16", 5,
                    null, IMG, "video-studio-image/u9/0123456789abcdef0123456789abcdef.png", null);
            assertEquals("VIDEO_STUDIO_ASSET_INVALID", code(flf));
        }

        @Test
        @DisplayName("首帧与尾帧可以是同一张图（首尾一致的循环镜头），参考素材里才不许重复")
        void sameImageForFirstAndLastFramePasses() {
            JsonNode item = submittedItem(jr(null, "first_last_frame_video", "循环", "768p", "9:16", 5,
                    null, IMG, IMG, null));
            assertEquals(IMG, item.path("variant_config").path("last_frame_key").asText());
        }
    }

    // ── 查询 / 出 wire ────────────────────────────────────────────────────────

    @Nested
    class Jobs {

        private MaterialVideoJob job(String status) {
            return MaterialVideoJob.builder()
                    .id("mvj_9").ownerUserId(USER).app(MaterialVideoJobService.APP_VIDEO_STUDIO)
                    .kind("studio-ref").name("全能参考 · 544p · 1:1 · 6 秒").prompt("图1在跳舞")
                    .durationSec(6).aspectRatio("1:1").status(status).progress(42)
                    .variantConfigJson("""
                        {"endpoint_id":"ep-h3","generation_mode":"universal_reference_video","resolution_tier":"544p","seed":7,
                         "reference_inputs":[{"media_type":"image","key":"k-a"},{"media_type":"audio","key":"k-b"},
                                             {"media_type":"image","key":"k-c"}],
                         "template_id":"vst_1","optimization_id":"vso_1","original_prompt":"图1跳舞"}""")
                    .creditsHeld(260L)
                    .providerUsed("MiniMax H3").modelUsed("minimax-h3")
                    .videoUrl("https://oss.example/material-videos/mvj_9/video.mp4")
                    .thumbnailUrl("https://oss.example/material-videos/mvj_9/thumbnail.jpg")
                    .errorMessage("视频模型拒绝了这次请求：prompt rejected")
                    .createdAt(OffsetDateTime.parse("2026-09-30T20:15:00+08:00"))
                    .completedAt(OffsetDateTime.parse("2026-09-30T20:17:30+08:00"))
                    .build();
        }

        @Test
        @DisplayName("任务出 wire：画布像素、种子、素材编号与现签地址、成片重签、积分、原提示词、模板来源、ISO 时间")
        void toJobMapsEverything() {
            when(jobRepo.findById("mvj_9")).thenReturn(Optional.of(job("succeeded")));
            VideoStudioJob j = svc.getJob(USER, "mvj_9");

            assertEquals("universal_reference_video", j.mode());
            assertEquals("544p", j.resolutionTier());
            assertEquals("1:1", j.aspectRatio());
            assertEquals(544, j.width());
            assertEquals(544, j.height());
            assertEquals(6, j.seconds());
            assertEquals(7L, j.seed());
            assertEquals("MiniMax H3", j.modelName());
            assertEquals("succeeded", j.status());
            assertEquals(42, j.progressPct());
            assertEquals("已完成", j.stage());
            assertEquals(List.of("图1", "音频1", "图2"), j.inputs().stream().map(i -> i.label()).toList());
            assertEquals(List.of("image", "audio", "image"), j.inputs().stream().map(i -> i.mediaType()).toList());
            assertEquals("https://cdn.test/k-b?sig=1", j.inputs().get(1).url());
            assertEquals("https://oss.example/material-videos/mvj_9/video.mp4?signed=1", j.videoUrl());
            assertEquals("https://oss.example/material-videos/mvj_9/thumbnail.jpg?signed=1", j.thumbnailUrl());
            assertNull(j.errorMessage(), "没失败就不给失败原因");
            assertEquals(260L, j.credits());
            assertEquals("图1跳舞", j.originalPrompt());
            assertEquals("vst_1", j.templateId());
            assertEquals("2026-09-30T20:15+08:00", j.createdAt());
            assertEquals("2026-09-30T20:17:30+08:00", j.completedAt());
        }

        @Test
        @DisplayName("状态映射：queued → queued，submitting / generating → running，failed 带原因")
        void statusMapping() {
            for (String[] pair : new String[][]{{"queued", "queued"}, {"submitting", "running"},
                    {"generating", "running"}, {"succeeded", "succeeded"}, {"failed", "failed"}}) {
                when(jobRepo.findById("mvj_9")).thenReturn(Optional.of(job(pair[0])));
                assertEquals(pair[1], svc.getJob(USER, "mvj_9").status(), pair[0]);
            }
            assertEquals("视频模型拒绝了这次请求：prompt rejected", svc.getJob(USER, "mvj_9").errorMessage());
        }

        @Test
        @DisplayName("首尾帧的素材标「首帧」「尾帧」；还没提交到厂商时模型名为 null；没优化、不是做同款时两者为 null")
        void frameLabelsAndPendingModel() {
            MaterialVideoJob j = job("queued");
            j.setVariantConfigJson("{\"generation_mode\":\"first_last_frame_video\",\"resolution_tier\":\"768p\","
                    + "\"first_frame_key\":\"k1\",\"last_frame_key\":\"k2\"}");
            j.setAspectRatio("9:16");
            j.setProviderUsed(null);
            j.setModelUsed(null);
            j.setVideoUrl(null);
            j.setThumbnailUrl(null);
            j.setCompletedAt(null);
            when(jobRepo.findById("mvj_9")).thenReturn(Optional.of(j));

            VideoStudioJob dto = svc.getJob(USER, "mvj_9");
            assertEquals(List.of("首帧", "尾帧"), dto.inputs().stream().map(i -> i.label()).toList());
            assertEquals(768, dto.width());
            assertEquals(1344, dto.height());
            assertNull(dto.modelName());
            assertNull(dto.videoUrl());
            assertNull(dto.completedAt());
            assertNull(dto.seed());
            assertNull(dto.originalPrompt());
            assertNull(dto.templateId());
        }

        @Test
        @DisplayName("不是本人的、不是本区的 → 404 VIDEO_STUDIO_JOB_NOT_FOUND")
        void getJobOwnerAndPartition() {
            MaterialVideoJob other = job("succeeded");
            other.setOwnerUserId("u2");
            when(jobRepo.findById("mvj_9")).thenReturn(Optional.of(other));
            assertEquals("VIDEO_STUDIO_JOB_NOT_FOUND",
                    assertThrows(BusinessException.class, () -> svc.getJob(USER, "mvj_9")).getCode());

            MaterialVideoJob celebrity = job("succeeded");
            celebrity.setApp(MaterialVideoJobService.APP_CELEBRITY);
            when(jobRepo.findById("mvj_9")).thenReturn(Optional.of(celebrity));
            assertEquals("VIDEO_STUDIO_JOB_NOT_FOUND",
                    assertThrows(BusinessException.class, () -> svc.getJob(USER, "mvj_9")).getCode());

            when(jobRepo.findById("nope")).thenReturn(Optional.empty());
            assertEquals("VIDEO_STUDIO_JOB_NOT_FOUND",
                    assertThrows(BusinessException.class, () -> svc.getJob(USER, "nope")).getCode());
        }

        @Test
        @DisplayName("列表只查本区分区，新 → 旧，最多 100 条")
        void listJobsIsScopedAndCapped() {
            List<MaterialVideoJob> rows = new ArrayList<>();
            for (int i = 0; i < 120; i++) {
                MaterialVideoJob j = job("queued");
                j.setId("mvj_" + i);
                rows.add(j);
            }
            when(jobRepo.findScoped(USER, MaterialVideoJobService.APP_VIDEO_STUDIO)).thenReturn(rows);
            List<VideoStudioJob> out = svc.listJobs(USER);
            assertEquals(100, out.size());
            assertEquals("mvj_0", out.get(0).id());
        }
    }
}
