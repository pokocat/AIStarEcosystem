package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiVideoRequestSpec;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.materialvideo.VideoGenSpec;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioCanvas;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioContract;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJob;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobInput;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioMediaLimit;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModeSpec;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioPricingConfig;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceRules;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier;
import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import com.aistareco.aep.videostudio.model.StudioTemplate;
import com.aistareco.aep.videostudio.repository.StudioPromptOptimizationRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 视频生成区（web-celebrity「AI 创作 → 视频生成」，v0.199，设计真源 docs/video-studio-plan.md）。
 *
 * <p>把 MiniMax H3 的四种原生模式原样开放：模型列表 / 提交 / 历史。**不另起炉灶**：提交走
 * {@link MaterialVideoJobService#submit}（分区 {@link MaterialVideoJobService#APP_VIDEO_STUDIO}）——
 * 冻结 → 落 {@code material_video_job} → afterCommit 派发 worker → 轮询 → 成片镜像 OSS → 成功扣 / 失败退。
 *
 * <p>提交生成与智能优化共用**同一个校验器** {@link #validate}（同一套顺序、同一套错误码）：模型 → 模式 → 提示词 →
 * 清晰度 / 比例 / 时长 → 种子 → 该模式的素材 → 素材归属与类型（含做同款的模板素材）。全部在冻结积分之前。
 * 价格只由服务端按 {@link VideoStudioPricing} 算，请求体里没有价格字段。
 */
@Service
public class VideoStudioService {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioService.class);

    /** 账本文案（冻结 / 扣除 / 退回三笔都是它）。 */
    static final String CREDIT_LABEL = "视频生成";
    /** 历史列表最多给多少条（新 → 旧）。 */
    static final int LIST_LIMIT = 100;

    /** variant_config 里本区自己的键（worker 不读，只用于回显）。 */
    static final String VC_TEMPLATE_ID = "template_id";
    static final String VC_OPTIMIZATION_ID = "optimization_id";
    static final String VC_ORIGINAL_PROMPT = "original_prompt";

    /** 模式的中文名（照抄厂商叫法）与本区任务的 kind（material_video_job.kind 列宽 16）。 */
    private static final Map<String, String> MODE_NAMES = Map.of(
            JusuanH3Contract.MODE_T2V, "文生视频",
            JusuanH3Contract.MODE_I2V, "首帧生视频",
            JusuanH3Contract.MODE_FIRST_LAST_FRAME, "首尾帧生视频",
            JusuanH3Contract.MODE_UNIVERSAL_REFERENCE, "全能参考");
    private static final Map<String, String> MODE_KINDS = Map.of(
            JusuanH3Contract.MODE_T2V, "studio-t2v",
            JusuanH3Contract.MODE_I2V, "studio-i2v",
            JusuanH3Contract.MODE_FIRST_LAST_FRAME, "studio-flf",
            JusuanH3Contract.MODE_UNIVERSAL_REFERENCE, "studio-ref");

    private final AiModelInvocationService invocation;
    private final MaterialVideoModelClient modelClient;
    private final MaterialVideoJobService videoJobs;
    private final MaterialVideoJobRepository jobRepo;
    private final FileStorageService fileStorage;
    private final CdnUrlSigner signer;
    private final FfmpegRunner ffmpeg;
    private final ObjectMapper om;
    private final VideoStudioPricingService pricingConfig;
    private final VideoStudioTemplateService templates;
    private final StudioPromptOptimizationRepository optimizations;

    public VideoStudioService(AiModelInvocationService invocation,
                              MaterialVideoModelClient modelClient,
                              MaterialVideoJobService videoJobs,
                              MaterialVideoJobRepository jobRepo,
                              FileStorageService fileStorage,
                              CdnUrlSigner signer,
                              FfmpegRunner ffmpeg,
                              ObjectMapper om,
                              VideoStudioPricingService pricingConfig,
                              VideoStudioTemplateService templates,
                              StudioPromptOptimizationRepository optimizations) {
        this.invocation = invocation;
        this.modelClient = modelClient;
        this.videoJobs = videoJobs;
        this.jobRepo = jobRepo;
        this.fileStorage = fileStorage;
        this.signer = signer;
        this.ffmpeg = ffmpeg;
        this.om = om;
        this.pricingConfig = pricingConfig;
        this.templates = templates;
        this.optimizations = optimizations;
    }

    // ── 模型列表 ──────────────────────────────────────────────────────────────

    /**
     * 「视频生成」用途下能在本区用的模型：应用开放的启用候选 × 可提交端点 × 视频请求规格。
     * 一个候选都没有时，默认绑定的端点若也满足条件就合成一条（{@code selectableById=false}，提交时必须省略
     * endpointId），与 {@link MaterialVideoJobService#listModels} 同一个口径。
     * 每个模型的计价 = 后台配置那一格 ?? 这个模型的每秒价 ?? 未定价（{@link VideoStudioPricing#effective}）。
     */
    @Transactional(readOnly = true)
    public List<VideoStudioModel> listModels() {
        return listModels("celebrity");
    }

    /** Each app resolves its own candidate/access scope; the endpoint holds the video contract. */
    @Transactional(readOnly = true)
    public List<VideoStudioModel> listModels(String appCode) {
        return resolvedModels(appCode).stream().map(ResolvedVideoModel::model).toList();
    }

    private record ResolvedVideoModel(VideoStudioModel model, AiVideoRequestSpec configured) {}

    private List<ResolvedVideoModel> resolvedModels(String appCode) {
        VideoStudioPricingConfig config = pricingConfig.current();
        List<ResolvedVideoModel> out = new ArrayList<>();
        for (AiModelInvocationService.ResolvedEndpoint r : invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION, appCode)) {
            if (!r.candidate().isEnabled() || !r.endpoint().isEnabled()) continue;
            if (!modelClient.isEndpointReady(r.endpoint()) || !hasVideoContract(r.endpoint())) continue;
            VideoStudioModel m = toModel(r.endpoint(), r.candidate(), r.isDefault(), true, config);
            if (m != null) out.add(new ResolvedVideoModel(m,
                    AiVideoRequestSpec.read(r.endpoint().getVideoRequestSpecJson())));
        }
        if (out.isEmpty() && "celebrity".equals(appCode)) {
            // 只在默认端点**根本没有候选行**时合成默认项。候选行在、只是被后台停用了，说明运营是有意下线它：
            // 此时再合成一条就等于绕过停用。
            AiModelInvocationService.ResolvedEndpoint def =
                    invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null, appCode).orElse(null);
            AiModelEndpoint ep = def == null ? null : def.endpoint();
            if (ep != null && def.candidate() == null
                    && modelClient.isEndpointReady(ep) && hasVideoContract(ep)) {
                VideoStudioModel m = toModel(ep, null, true, false, config);
                if (m != null) out.add(new ResolvedVideoModel(m,
                        AiVideoRequestSpec.read(ep.getVideoRequestSpecJson())));
            }
        }
        return out;
    }

    private boolean hasVideoContract(AiModelEndpoint endpoint) {
        return AiVideoRequestSpec.read(endpoint.getVideoRequestSpecJson()) != null
                || modelClient.isJusuanMedia(endpoint); // Existing H3 endpoints until their editable rows are seeded.
    }

    private VideoStudioModel toModel(AiModelEndpoint ep, AiAppEndpointCandidate candidate, boolean isDefault,
                                     boolean selectableById, VideoStudioPricingConfig config) {
        AiVideoRequestSpec configured = AiVideoRequestSpec.read(ep.getVideoRequestSpecJson());
        VideoStudioContract videoContract = configured == null ? null : configured.contract();
        MaterialVideoModelClient.DurationBounds protocol = modelClient.protocolDurationBounds(ep);
        MaterialVideoModelClient.DurationBounds bounds = MaterialVideoModelClient.intersect(
                protocol != null ? protocol
                        : new MaterialVideoModelClient.DurationBounds(JusuanH3Contract.MIN_SECONDS, JusuanH3Contract.MAX_SECONDS),
                candidate);
        int contractMin = videoContract == null ? JusuanH3Contract.MIN_SECONDS : videoContract.minSeconds();
        int contractMax = videoContract == null ? JusuanH3Contract.MAX_SECONDS : videoContract.maxSeconds();
        int min = Math.max(contractMin, bounds.minSec() == null ? contractMin : bounds.minSec());
        int max = Math.min(contractMax, bounds.maxSec() == null ? contractMax : bounds.maxSec());
        if (min > max) {
            // 后台把候选的最长时长配得比厂商下限还短：任何时长都提交不了，列出来只会让用户走到最后一步才失败。
            log.warn("[video-studio] 端点「{}」的有效时长区间为空（{}–{} 秒），不列出。请检查候选的最长时长配置",
                    ep.getName(), min, max);
            return null;
        }
        // 这个模型的每秒价：只有「候选配了 override 且端点按秒计费」才算数（与带货线的按秒展开同一个判定）。
        // 模型单价 ≤ 0 当「没定价」而不是「免费」：后台给格子定价要求 ≥ 1，模型单价这条回落路也得同一个口径，
        // 否则运营把某个模型的单价填成 0，视频生成里所有没单独定价的格子就悄悄全免费了（§8.0 依赖没配好要明确报错）。
        Long override=candidate==null?null:candidate.getCreditCostOverride();
        Long modelRate = "per_second".equals(AiModelInvocationService.videoBillingUnit(ep, candidate))
                && override!=null && override > 0 ? override : null;
        VideoStudioContract effectiveContract = videoContract == null ? contract(min, max)
                : new VideoStudioContract(videoContract.modes(), videoContract.tiers(), min, max,
                        videoContract.promptMaxChars(), videoContract.seedMax());
        return new VideoStudioModel(ep.getId(), ep.publicModelName(), isDefault, selectableById,
                modelClient.isJusuanMedia(ep), effectiveContract,
                VideoStudioPricing.effective(config, modelRate, effectiveContract),
                configured==null?List.of(1,2,4):configured.allowedBatchCounts());
    }

    /** H3 合同出 wire（数字全部来自 {@link JusuanH3Contract}）；时长区间按端点算。 */
    public static VideoStudioContract contract(int minSeconds, int maxSeconds) {
        VideoStudioMediaLimit frame = new VideoStudioMediaLimit(JusuanH3Contract.MEDIA_IMAGE, 1,
                JusuanH3Contract.FRAME_IMAGE_MAX_BYTES, JusuanH3Contract.IMAGE_FORMATS, null, null);
        VideoStudioReferenceRules references = new VideoStudioReferenceRules(
                new VideoStudioMediaLimit(JusuanH3Contract.MEDIA_IMAGE, JusuanH3Contract.REFERENCE_IMAGE_MAX_COUNT,
                        JusuanH3Contract.REFERENCE_IMAGE_MAX_BYTES, JusuanH3Contract.IMAGE_FORMATS, null, null),
                new VideoStudioMediaLimit(JusuanH3Contract.MEDIA_VIDEO, JusuanH3Contract.REFERENCE_VIDEO_MAX_COUNT,
                        JusuanH3Contract.REFERENCE_VIDEO_MAX_BYTES, JusuanH3Contract.VIDEO_FORMATS, null, null),
                new VideoStudioMediaLimit(JusuanH3Contract.MEDIA_AUDIO, JusuanH3Contract.REFERENCE_AUDIO_MAX_COUNT,
                        JusuanH3Contract.REFERENCE_AUDIO_MAX_BYTES, JusuanH3Contract.AUDIO_FORMATS,
                        JusuanH3Contract.AUDIO_MIN_SECONDS, JusuanH3Contract.AUDIO_MAX_SECONDS),
                JusuanH3Contract.REFERENCE_IMAGE_MAX_WITH_VIDEO, JusuanH3Contract.REFERENCE_MAX_TOTAL,
                JusuanH3Contract.REFERENCE_MIN_VISUAL, JusuanH3Contract.AUDIO_TOTAL_MAX_SECONDS);
        List<VideoStudioModeSpec> modes = List.of(
                new VideoStudioModeSpec(JusuanH3Contract.MODE_T2V, false, false, null, null),
                new VideoStudioModeSpec(JusuanH3Contract.MODE_I2V, true, false, frame, null),
                new VideoStudioModeSpec(JusuanH3Contract.MODE_FIRST_LAST_FRAME, true, true, frame, null),
                new VideoStudioModeSpec(JusuanH3Contract.MODE_UNIVERSAL_REFERENCE, false, false, null, references));
        List<VideoStudioTier> tiers = JusuanH3Contract.TIERS.stream()
                .map(t -> new VideoStudioTier(t, JusuanH3Contract.canvases(t).stream()
                        .map(c -> new VideoStudioCanvas(c.aspectRatio(), c.width(), c.height()))
                        .toList()))
                .toList();
        return new VideoStudioContract(modes, tiers, minSeconds, maxSeconds,
                JusuanH3Contract.PROMPT_MAX_CHARS, JusuanH3Contract.SEED_MAX);
    }

    // ── 校验器（提交生成与智能优化共用）─────────────────────────────────────────

    /** 两种请求共同的那部分（生成请求与优化请求的字段是同一套，优化不带种子）。 */
    record Draft(String endpointId, String mode, String prompt, String resolutionTier, String aspectRatio,
                 Integer seconds, Long seed, String firstFrameKey, String lastFrameKey,
                 List<VideoStudioReferenceInput> references, String templateId) {

        static Draft of(VideoStudioJobRequest r) {
            return r == null ? empty() : new Draft(r.endpointId(), r.mode(), r.prompt(), r.resolutionTier(),
                    r.aspectRatio(), r.seconds(), r.seed(), r.firstFrameKey(), r.lastFrameKey(), r.references(),
                    r.templateId());
        }

        static Draft of(VideoStudioOptimizationRequest r) {
            return r == null ? empty() : new Draft(r.endpointId(), r.mode(), r.prompt(), r.resolutionTier(),
                    r.aspectRatio(), r.seconds(), null, r.firstFrameKey(), r.lastFrameKey(), r.references(),
                    r.templateId());
        }

        private static Draft empty() {
            return new Draft(null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    /** 校验过的素材输入（key 已去空白，参考素材保持客户端给的顺序）。 */
    record Inputs(String firstFrameKey, String lastFrameKey, List<VideoGenSpec.Reference> references) {
        int referenceImages() {
            return (int) references.stream().filter(r -> JusuanH3Contract.MEDIA_IMAGE.equals(r.mediaType())).count();
        }
    }

    /** 校验通过的请求。{@code template} 为 null = 不是做同款。 */
    record Validated(VideoStudioModel model, VideoStudioModeSpec modeSpec, String prompt, String tier,
                     String aspectRatio, int seconds, Long seed, Inputs inputs, StudioTemplate template) {
        String mode() {
            return modeSpec.mode();
        }

        /** 交给通用视频链 / 模型客户端的输入规格。 */
        VideoGenSpec spec() {
            return new VideoGenSpec(mode(), tier, seed, inputs.firstFrameKey(), inputs.lastFrameKey(), inputs.references());
        }
    }

    /**
     * 唯一的校验器。顺序固定：模型 → 模式 → 提示词 → 清晰度 / 比例 / 时长 → 种子（有才看）→ 该模式的素材 →
     * 素材归属与类型（做同款时模板素材也算）→ 音频合计。全部在冻结积分之前。
     */
    Validated validate(String userId, Draft d) {
        return validate(userId, d, null);
    }

    /** Canvas keeps its own asset ownership; mode, geometry, limits and pricing share this validator. */
    public record CanvasPreparation(VideoGenSpec spec, long credits, long seedMax) {
        public CanvasPreparation(VideoGenSpec spec, long credits) {
            this(spec, credits, 2_147_483_647L);
        }
    }

    @FunctionalInterface
    public interface CanvasAssetValidator {
        void accept(String mediaType, String key, boolean frame);
    }

    public CanvasPreparation prepareCanvas(String userId, VideoStudioJobRequest request,
            java.util.function.BiConsumer<String, String> requireCanvasAsset) {
        return prepareCanvas(userId, request,
                requireCanvasAsset == null ? null : (type, key, frame) -> requireCanvasAsset.accept(type, key),
                "celebrity");
    }

    public CanvasPreparation prepareCanvas(String userId, VideoStudioJobRequest request,
            CanvasAssetValidator requireCanvasAsset) {
        return prepareCanvas(userId, request, requireCanvasAsset, "celebrity");
    }

    public CanvasPreparation prepareCanvas(String userId, VideoStudioJobRequest request,
            CanvasAssetValidator requireCanvasAsset, String appCode) {
        if (request == null || request.templateId() != null || request.optimizationId() != null)
            throw inputInvalid("画布视频请直接选择画布素材");
        Validated v = validate(userId, Draft.of(request), requireCanvasAsset, appCode);
        return new CanvasPreparation(v.spec(), VideoStudioPricing.total(v.model().pricing(), v.mode(),
                v.tier(), v.seconds(), v.inputs().referenceImages(), v.modeSpec().references() != null),
                v.model().contract().seedMax());
    }

    private Validated validate(String userId, Draft d,
            java.util.function.BiConsumer<String, String> requireCanvasAsset) {
        return validate(userId, d,
                requireCanvasAsset == null ? null : (type, key, frame) -> requireCanvasAsset.accept(type, key),
                "celebrity");
    }

    private Validated validate(String userId, Draft d,
            CanvasAssetValidator requireCanvasAsset, String appCode) {
        // 1) 模型
        ResolvedVideoModel selectedModel = pickResolvedModel(resolvedModels(appCode), d.endpointId());
        VideoStudioModel model = selectedModel.model();
        VideoStudioContract contract = model.contract();

        // 2) 模式
        VideoStudioModeSpec modeSpec = contract.modes().stream()
                .filter(m -> m.mode().equals(d.mode())).findFirst().orElse(null);
        if (d.mode() == null || modeSpec == null) {
            throw BusinessException.badRequest("VIDEO_STUDIO_MODE_INVALID",
                    "所选模型不支持这个生成模式，请重新选择");
        }

        // 3) 提示词：是否必填写在当前模式的端点合同中；长度上限也由合同决定。
        String prompt = stripBlank(d.prompt());
        if (prompt.isEmpty() && !Boolean.FALSE.equals(modeSpec.promptRequired()))
            throw BusinessException.badRequest("VIDEO_STUDIO_PROMPT_REQUIRED", "请先写提示词");
        int promptChars = prompt.codePointCount(0, prompt.length());
        if (promptChars > contract.promptMaxChars()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_PROMPT_TOO_LONG",
                    "提示词最多 " + contract.promptMaxChars() + " 字，现在是 " + promptChars + " 字");
        }

        // 4) 清晰度 / 比例 / 时长
        VideoStudioTier tier = contract.tiers().stream()
                .filter(t -> t.tier().equals(d.resolutionTier())).findFirst().orElse(null);
        if (tier == null) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID",
                    "清晰度只能选 " + String.join(" 或 ", contract.tiers().stream().map(VideoStudioTier::tier).toList()));
        }
        VideoStudioCanvas canvas = tier.canvases().stream()
                .filter(c -> c.aspectRatio().equals(d.aspectRatio())).findFirst().orElse(null);
        if (canvas == null) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID",
                    "画面比例只能选 " + String.join("、", tier.canvases().stream().map(VideoStudioCanvas::aspectRatio).toList()));
        }
        Integer seconds = d.seconds();
        if (seconds == null) throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID", "请选择视频时长");
        if (seconds < contract.minSeconds() || seconds > contract.maxSeconds()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID",
                    "视频时长要在 " + contract.minSeconds() + " 到 " + contract.maxSeconds() + " 秒之间，现在是 " + seconds + " 秒");
        }

        // 5) 随机种子（不传 = 随机；智能优化不带种子）
        Long seed = d.seed();
        if (seed != null && (seed < 0 || seed > contract.seedMax())) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID",
                    "随机种子要在 0 到 " + contract.seedMax() + " 之间，不填就是随机");
        }

        // 6) 该模式要的素材
        Inputs inputs = requireInputsForMode(modeSpec, d);

        // 7) 素材归属与类型：本人在本区上传的那一类，或做同款时这个模板自带的同类素材
        StudioTemplate template = null;
        Map<String, String> templateMaterials = Map.of();
        String templateId = blankToNull(d.templateId());
        if (templateId != null) {
            template = templates.findVisible(userId, templateId)
                    .orElseThrow(() -> BusinessException.notFound("VIDEO_STUDIO_TEMPLATE_NOT_FOUND",
                            "这个模板已经下架或看不到了，可以点「不做同款了」继续用自己的素材"));
            templateMaterials = templates.materialTypes(template);
        }
        Map<String, Double> audioDurations = Map.of();
        if (requireCanvasAsset == null) {
            requireUsableInputs(userId, inputs, templateMaterials);
            if (selectedModel.configured() != null) audioDurations = requireConfiguredInputs(inputs, modeSpec);
        }
        else {
            if (inputs.firstFrameKey() != null) requireCanvasAsset.accept("image", inputs.firstFrameKey(), true);
            if (inputs.lastFrameKey() != null) requireCanvasAsset.accept("image", inputs.lastFrameKey(), true);
            for (VideoGenSpec.Reference ref : inputs.references())
                requireCanvasAsset.accept(ref.mediaType(), ref.key(), false);
        }
        requireAudioTotal(inputs.references(), modeSpec.references(), audioDurations);

        return new Validated(model, modeSpec, prompt, tier.tier(), canvas.aspectRatio(), seconds, seed, inputs, template);
    }

    // ── 提交生成 ──────────────────────────────────────────────────────────────

    @Transactional
    public VideoStudioJob submit(String userId, VideoStudioJobRequest req) {
        Validated v = validate(userId, Draft.of(req));
        StudioPromptOptimization optimization = requireUsableOptimization(userId, req == null ? null : req.optimizationId());

        // 价格（与 GET /models 下发的是同一组数）。这一格没定价 → 503，冻结之前。
        long price = VideoStudioPricing.total(v.model().pricing(), v.mode(), v.tier(), v.seconds(),
                v.inputs().referenceImages(), v.modeSpec().references() != null);

        ObjectNode item = om.createObjectNode();
        item.put("name", configuredModeName(v.modeSpec()) + " · " + v.tier() + " · " + v.aspectRatio() + " · " + v.seconds() + " 秒");
        // The database kind column is short; the full configurable mode lives in variant_config.
        item.put("kind", MODE_KINDS.getOrDefault(v.mode(), "studio-custom"));
        item.put("prompt", v.prompt());
        item.put("duration_sec", v.seconds());
        item.put("aspect_ratio", v.aspectRatio());
        item.put("credit_cost", price);
        item.put("credit_label", CREDIT_LABEL);
        ObjectNode vc = item.putObject("variant_config");
        // 能按编号选的模型把端点钉死在任务上：报价用的是这个候选的单价，worker 就必须跑在它上面，
        // 不能随「默认绑定」在提交与派发之间漂走。合成的默认项没有候选行，写了编号会被白名单拒，所以不写。
        if (v.model().selectableById()) vc.put("endpoint_id", v.model().endpointId());
        // 用了智能优化的提示词不再让厂商出片前改写一遍（公开契约：已手动优化的 prompt 应传 optimizePrompt=false）。
        // 此前两边都改：用户审过、可能还改过的那份描述会被厂商再改写一次，还多一次厂商的改写费用。
        // 优化完换成了不会改写的模型：那个模型本来就原文出片，不带这个开关。
        (optimization != null && v.model().supportsPromptOptimization() ? v.spec().withOptimizePrompt(false) : v.spec()).writeTo(vc);
        VideoStudioCanvas selectedCanvas = v.model().contract().tiers().stream()
                .filter(t -> t.tier().equals(v.tier()))
                .flatMap(t -> t.canvases().stream())
                .filter(c -> c.aspectRatio().equals(v.aspectRatio()))
                .findFirst().orElseThrow(); // validate() already selected this canvas.
        vc.put("display_width", selectedCanvas.width());
        vc.put("display_height", selectedCanvas.height());
        // 以下几个键 worker 不读，只用于回显（做同款来源、用了智能优化时的原提示词）。
        if (v.template() != null) vc.put(VC_TEMPLATE_ID, v.template().getId());
        if (optimization != null) {
            vc.put(VC_OPTIMIZATION_ID, optimization.getId());
            vc.put(VC_ORIGINAL_PROMPT, optimization.getOriginalPrompt());
        }

        ObjectNode body = om.createObjectNode();
        body.putArray("items").add(item);
        List<JsonNode> created = videoJobs.submit(body, userId, MaterialVideoJobService.APP_VIDEO_STUDIO);
        String jobId = created.isEmpty() ? null : created.get(0).path("id").asText(null);
        MaterialVideoJob job = jobId == null ? null : jobRepo.findById(jobId).orElse(null);
        if (job == null) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "VIDEO_STUDIO_SUBMIT_FAILED",
                    "任务没有建起来，请稍后再试");
        }
        // 做同款成功建出任务才计数（同一事务：提交失败回滚时计数一起回滚）。
        if (v.template() != null) templates.countUse(v.template().getId());
        log.info("[video-studio] 已提交 user={} job={} mode={} tier={} aspect={} seconds={} refs={} price={} template={} optimization={}",
                userId, job.getId(), v.mode(), v.tier(), v.aspectRatio(), v.seconds(), v.inputs().references().size(),
                price, v.template() == null ? null : v.template().getId(), optimization == null ? null : optimization.getId());
        return toJob(job);
    }

    /**
     * 生成时带了 optimizationId：必须是本人的、已经成功的。不要求模式 / 规格与优化时一致（用户可以优化完再改）。
     * 送去生成的仍是请求里的最终文本（可能是用户改过的优化结果），这里只核对归属、记下原提示词。
     */
    private StudioPromptOptimization requireUsableOptimization(String userId, String optimizationId) {
        String id = blankToNull(optimizationId);
        if (id == null) return null;
        return optimizations.findById(id)
                .filter(o -> userId != null && userId.equals(o.getOwnerUserId()))
                .filter(o -> StudioPromptOptimization.STATUS_SUCCEEDED.equals(o.getStatus()))
                .orElseThrow(() -> BusinessException.badRequest("VIDEO_STUDIO_OPTIMIZATION_INVALID",
                        "这次智能优化还没完成或已经失效，可以重新优化，或者直接用原提示词生成"));
    }

    /** 省略 endpointId = 用默认那一个；给了就必须是列表里能按编号选的那一个。 */
    private static ResolvedVideoModel pickResolvedModel(List<ResolvedVideoModel> models, String endpointId) {
        if (models.isEmpty()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                    "视频模型暂未开通，暂时不能生成");
        }
        String id = endpointId == null ? null : endpointId.trim();
        if (id == null || id.isEmpty()) {
            return models.stream().filter(m -> m.model().isDefault()).findFirst()
                    .orElseThrow(() -> BusinessException.badRequest("VIDEO_STUDIO_MODEL_UNSUPPORTED", "请先选择一个视频模型"));
        }
        return models.stream().filter(m -> m.model().selectableById() && m.model().endpointId().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.badRequest("VIDEO_STUDIO_MODEL_UNSUPPORTED",
                        "所选视频模型不能在这里用，请刷新后重新选择"));
    }

    /** Resolve upload limits from the same selectable model and mode used by submission. */
    @Transactional(readOnly = true)
    public VideoStudioMediaLimit uploadRule(String endpointId, String mode, String mediaType, boolean frame) {
        if (mediaType == null) throw BusinessException.badRequest("VIDEO_STUDIO_MODE_INVALID", "请选择素材类型");
        VideoStudioModel model = pickResolvedModel(resolvedModels("celebrity"), endpointId).model();
        VideoStudioModeSpec selected = model.contract().modes().stream()
                .filter(item -> item.mode().equals(mode)).findFirst()
                .orElseThrow(() -> BusinessException.badRequest("VIDEO_STUDIO_MODE_INVALID", "所选视频模式暂不可用"));
        VideoStudioMediaLimit limit = frame ? selected.frameImage() : selected.references() == null ? null
                : switch (mediaType) {
                    case "image" -> selected.references().image();
                    case "video" -> selected.references().video();
                    case "audio" -> selected.references().audio();
                    default -> null;
                };
        if (limit == null || !mediaType.equals(limit.mediaType()))
            throw BusinessException.badRequest("VIDEO_STUDIO_MODE_INVALID", "所选视频模式不支持该素材");
        return limit;
    }

    /** 素材与模式是否匹配。每一条报错都说清是哪一条（缺首帧、带了不该带的、超数量、没有视觉素材、重复…）。 */
    private static Inputs requireInputsForMode(VideoStudioModeSpec spec, Draft d) {
        String name = configuredModeName(spec);
        String first = blankToNull(d.firstFrameKey());
        String last = blankToNull(d.lastFrameKey());
        List<VideoStudioReferenceInput> refs = d.references() == null ? List.of() : d.references();
        boolean referenceMode = spec.references() != null;

        if (spec.needsFirstFrame() && first == null) throw inputInvalid(name + "需要一张首帧图");
        if (!spec.needsFirstFrame() && first != null) {
            throw inputInvalid(name + "不用传首帧图");
        }
        if (spec.needsLastFrame() && last == null) throw inputInvalid(name + "需要一张尾帧图");
        if (!spec.needsLastFrame() && last != null) {
            throw inputInvalid(name + "不用传尾帧图");
        }
        if (!referenceMode) {
            if (!refs.isEmpty()) throw inputInvalid(name + "不用传参考素材");
            return new Inputs(first, last, List.of());
        }

        VideoStudioReferenceRules rules = spec.references();
        if (refs.isEmpty() && rules.minVisual() > 0)
            throw inputInvalid(name + "至少要 " + rules.minVisual() + " 个参考图片或视频素材");
        if (refs.size() > rules.maxTotal()) {
            throw inputInvalid("参考素材最多 " + rules.maxTotal() + " 个，现在是 " + refs.size() + " 个");
        }
        List<VideoGenSpec.Reference> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        int images = 0;
        int videos = 0;
        int audios = 0;
        for (VideoStudioReferenceInput r : refs) {
            if (r == null || !JusuanH3Contract.isMediaType(r.mediaType())) {
                throw inputInvalid("参考素材的类型只能是图片、视频或音频");
            }
            String key = blankToNull(r.key());
            if (key == null) throw inputInvalid("有一个参考素材还没上传完，请重新上传");
            if (!seen.add(key)) throw inputInvalid("同一个素材只能用一次，请删掉重复的那个");
            switch (r.mediaType()) {
                case JusuanH3Contract.MEDIA_VIDEO -> videos++;
                case JusuanH3Contract.MEDIA_AUDIO -> audios++;
                default -> images++;
            }
            out.add(new VideoGenSpec.Reference(r.mediaType(), key));
        }
        if (images > rules.image().maxCount()) {
            throw inputInvalid("参考图片最多 " + rules.image().maxCount() + " 张，现在是 " + images + " 张");
        }
        if (videos > rules.video().maxCount()) {
            throw inputInvalid("参考视频最多 " + rules.video().maxCount() + " 段，现在是 " + videos + " 段");
        }
        if (audios > rules.audio().maxCount()) {
            throw inputInvalid("参考音频最多 " + rules.audio().maxCount() + " 段，现在是 " + audios + " 段");
        }
        if (videos > 0 && images > rules.maxImagesWithVideo()) {
            throw inputInvalid("带了参考视频时，参考图片最多 " + rules.maxImagesWithVideo() + " 张，现在是 " + images + " 张");
        }
        if (images + videos < rules.minVisual())
            throw inputInvalid("参考图片和视频合计至少要 " + rules.minVisual() + " 个");
        return new Inputs(first, last, out);
    }

    /** 每个 key 都得用得上：本人在本区上传的同类素材，或这次做同款的模板自带的同类素材（首帧 / 尾帧只能是图片）。 */
    private static void requireUsableInputs(String userId, Inputs in, Map<String, String> templateMaterials) {
        if (in.firstFrameKey() != null) {
            requireUsableKey(userId, in.firstFrameKey(), JusuanH3Contract.MEDIA_IMAGE, "首帧图", templateMaterials);
        }
        if (in.lastFrameKey() != null) {
            requireUsableKey(userId, in.lastFrameKey(), JusuanH3Contract.MEDIA_IMAGE, "尾帧图", templateMaterials);
        }
        List<String> labels = VideoGenSpec.referenceLabels(in.references());
        for (int i = 0; i < in.references().size(); i++) {
            VideoGenSpec.Reference r = in.references().get(i);
            requireUsableKey(userId, r.key(), r.mediaType(), labels.get(i), templateMaterials);
        }
    }

    /**
     * 做同款时，模板自带的素材可以原样带回 —— 只限**这个**模板里的 key，且类型一致（模板里的图不能当音频用）。
     * 其它一律走本人素材的归属闸。
     */
    static void requireUsableKey(String userId, String key, String mediaType, String label,
                                 Map<String, String> templateMaterials) {
        if (mediaType.equals(templateMaterials.get(key)) && !key.contains("..")) return;
        requireOwnedKey(userId, key, mediaType, label);
    }

    /**
     * 归属闸：key 必须以 {@code video-studio-<声明类型>/<本人>/} 开头（前缀由存储层自己的 key 规则派生，
     * 见 {@link FileStorageService#ownedKeyPrefix}），且不含 {@code ..} / 反斜杠、前缀后面只有文件名。
     * 不校验就等于：抄别人的 key 拿别人的素材出片，或用 {@code ../} 让 openForRead 读到本机任意文件。
     */
    static void requireOwnedKey(String userId, String key, String mediaType, String label) {
        if (!key.contains("..") && !key.contains("\\")) {
            String prefix = FileStorageService.ownedKeyPrefix(VideoStudioUploadService.categoryOf(mediaType), userId);
            if (key.startsWith(prefix) && key.length() > prefix.length() && key.indexOf('/', prefix.length()) < 0) return;
            for (String other : JusuanH3Contract.MEDIA_TYPES) {
                if (other.equals(mediaType)) continue;
                String otherPrefix = FileStorageService.ownedKeyPrefix(VideoStudioUploadService.categoryOf(other), userId);
                if (key.startsWith(otherPrefix)) {
                    throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID",
                            label + "要用" + typeName(mediaType) + "，这里放的是" + typeName(other));
                }
            }
        }
        throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID", label + "不是在这里上传的素材，请重新上传");
    }

    /** Recheck stored bytes against the chosen model; an asset may have been uploaded for a looser model. */
    private Map<String, Double> requireConfiguredInputs(Inputs inputs, VideoStudioModeSpec mode) {
        Map<String, Double> audioDurations = new HashMap<>();
        if (inputs.firstFrameKey() != null)
            requireConfiguredMedia(inputs.firstFrameKey(), "image", mode.frameImage(), "首帧图", audioDurations);
        if (inputs.lastFrameKey() != null)
            requireConfiguredMedia(inputs.lastFrameKey(), "image", mode.frameImage(), "尾帧图", audioDurations);
        List<String> labels = VideoGenSpec.referenceLabels(inputs.references());
        for (int i = 0; i < inputs.references().size(); i++) {
            VideoGenSpec.Reference ref = inputs.references().get(i);
            VideoStudioReferenceRules rules = mode.references();
            VideoStudioMediaLimit limit = rules == null ? null : switch (ref.mediaType()) {
                case "image" -> rules.image();
                case "video" -> rules.video();
                case "audio" -> rules.audio();
                default -> null;
            };
            requireConfiguredMedia(ref.key(), ref.mediaType(), limit, labels.get(i), audioDurations);
        }
        return audioDurations;
    }

    private void requireConfiguredMedia(String key, String type, VideoStudioMediaLimit rule, String label,
                                        Map<String, Double> audioDurations) {
        if (rule == null || !type.equals(rule.mediaType()))
            throw inputInvalid(label + "不符合当前模型的素材规则");
        Path path;
        long bytes;
        byte[] header;
        try {
            path = fileStorage.openForRead(key);
            bytes = Files.size(path);
            try (InputStream in = Files.newInputStream(path)) {
                header = in.readNBytes(4096);
            }
        } catch (Exception e) {
            log.warn("[video-studio] 素材读取失败 key={} err={}", key, e.toString());
            throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID", label + "已不可用，请重新上传");
        }
        if (bytes < 1 || bytes > rule.maxBytes())
            throw inputInvalid(label + "超过当前模型的文件大小上限，请重新选择");
        if (!MediaBytes.allowed(MediaBytes.sniffConfigured(type, header), rule.formats()))
            throw inputInvalid(label + "的实际格式不符合当前模型要求，请重新选择");
        if ("image".equals(type)) return;
        FfmpegRunner.MediaProbe probe = ffmpeg.probeMedia(path.toFile());
        if (probe == null || !probe.readable() || "video".equals(type) && !probe.hasVideo()
                || "audio".equals(type) && !probe.hasAudio())
            throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID", label + "读不出来，请重新上传");
        double duration = probe.durationSec();
        if ("audio".equals(type) && (!Double.isFinite(duration) || duration <= 0))
            throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID", label + "的时长读不出来，请重新上传");
        if ((rule.minDurationSec() != null || rule.maxDurationSec() != null)
                && (!Double.isFinite(duration) || duration <= 0
                    || rule.minDurationSec() != null && duration < rule.minDurationSec()
                    || rule.maxDurationSec() != null && duration > rule.maxDurationSec()))
            throw inputInvalid(label + "的时长不符合当前模型要求");
        if ("audio".equals(type)) audioDurations.put(key, duration);
    }

    /** 音频总时长按当前模型合同校验；当总上限低于单段上限时，一段也需要重新探测。 */
    private void requireAudioTotal(List<VideoGenSpec.Reference> references, VideoStudioReferenceRules rules,
                                   Map<String, Double> knownDurations) {
        if (rules == null) return;
        List<String> audioKeys = references.stream()
                .filter(r -> JusuanH3Contract.MEDIA_AUDIO.equals(r.mediaType()))
                .map(VideoGenSpec.Reference::key).toList();
        if (audioKeys.isEmpty()) return;
        Integer singleMax = rules.audio().maxDurationSec();
        if (audioKeys.size() == 1 && singleMax != null && rules.maxAudioTotalSec() >= singleMax) return;
        double total = 0;
        for (String key : audioKeys) total += knownDurations.containsKey(key)
                ? knownDurations.get(key) : probeAudioSeconds(key);
        if (total > rules.maxAudioTotalSec()) {
            throw inputInvalid("参考音频加起来不能超过 " + rules.maxAudioTotalSec() + " 秒，现在是 "
                    + VideoStudioUploadService.oneDecimal(total) + " 秒");
        }
    }

    private double probeAudioSeconds(String key) {
        try {
            Path path = fileStorage.openForRead(key);
            FfmpegRunner.MediaProbe probe = ffmpeg.probeMedia(path.toFile());
            if (probe.readable() && probe.hasAudio() && probe.durationSec() > 0) return probe.durationSec();
        } catch (Exception e) {
            log.warn("[video-studio] 读取参考音频失败 key={} err={}", key, e.toString());
        }
        throw BusinessException.badRequest("VIDEO_STUDIO_ASSET_INVALID", "有一段参考音频读不出来，请重新上传");
    }

    /** 模式的中文名（文生视频 / 首帧生视频 / 首尾帧生视频 / 全能参考）。 */
    static String modeName(String mode) {
        String name = mode == null ? null : MODE_NAMES.get(mode);
        return name == null ? "视频生成" : name;
    }

    private static String configuredModeName(VideoStudioModeSpec spec) {
        return spec.label() == null ? MODE_NAMES.getOrDefault(spec.mode(), spec.mode()) : spec.label();
    }

    // ── 查询 ─────────────────────────────────────────────────────────────────

    /** 本人在本区的任务，新 → 旧，最多 {@value #LIST_LIMIT} 条。 */
    @Transactional(readOnly = true)
    public List<VideoStudioJob> listJobs(String userId) {
        return jobRepo.findScoped(userId, MaterialVideoJobService.APP_VIDEO_STUDIO).stream()
                .limit(LIST_LIMIT)
                .map(this::toJob)
                .toList();
    }

    /** 不是本人的、不是本区的，一律当不存在。 */
    @Transactional(readOnly = true)
    public VideoStudioJob getJob(String userId, String id) {
        return jobRepo.findById(id == null ? "" : id)
                .filter(j -> userId != null && userId.equals(j.getOwnerUserId()))
                .filter(j -> MaterialVideoJobService.APP_VIDEO_STUDIO.equals(j.getApp()))
                .map(this::toJob)
                .orElseThrow(() -> BusinessException.notFound("VIDEO_STUDIO_JOB_NOT_FOUND", "没有找到这条生成记录"));
    }

    /**
     * {@code MaterialVideoJob} → {@link VideoStudioJob}。素材地址从 variant_config 里的 key **出 wire 时现签**
     * （§4.7.7，库里不存 URL）；成片 / 封面经 {@link CdnUrlSigner#maybeSign} 重签。
     */
    VideoStudioJob toJob(MaterialVideoJob job) {
        JsonNode vc = readTree(job.getVariantConfigJson());
        VideoGenSpec spec = VideoGenSpec.fromVariantConfig(vc);
        String mode = spec.generationMode() != null ? spec.generationMode() : modeOfKind(job.getKind());
        // Current endpoint settings may change while a task runs. Use dimensions accepted with this job.
        int configuredWidth = vc == null ? 0 : vc.path("display_width").asInt(0);
        int configuredHeight = vc == null ? 0 : vc.path("display_height").asInt(0);
        boolean hasCanvasSnapshot = configuredWidth > 0 && configuredHeight > 0;
        JusuanH3Contract.Canvas legacyCanvas = hasCanvasSnapshot ? null
                : JusuanH3Contract.canvas(spec.resolutionTier(), job.getAspectRatio());
        Integer width = hasCanvasSnapshot ? Integer.valueOf(configuredWidth)
                : legacyCanvas == null ? null : Integer.valueOf(legacyCanvas.width());
        Integer height = hasCanvasSnapshot ? Integer.valueOf(configuredHeight)
                : legacyCanvas == null ? null : Integer.valueOf(legacyCanvas.height());
        String status = wireStatus(job.getStatus());
        return new VideoStudioJob(
                job.getId(),
                nz(mode),
                nz(job.getPrompt()),
                nz(spec.resolutionTier()),
                nz(job.getAspectRatio()),
                width,
                height,
                job.getDurationSec(),
                spec.seed(),
                modelName(job),
                status,
                Math.max(0, Math.min(100, job.getProgress())),
                MaterialVideoJobService.stageLabel(job.getStatus()),
                inputsOf(spec),
                signUrl(job.getVideoUrl()),
                signUrl(job.getThumbnailUrl()),
                "failed".equals(status) ? job.getErrorMessage() : null,
                Math.max(0L, job.getCreditsHeld()),
                textOrNull(vc, VC_ORIGINAL_PROMPT),
                textOrNull(vc, VC_TEMPLATE_ID),
                iso(job.getCreatedAt()),
                iso(job.getCompletedAt()));
    }

    private List<VideoStudioJobInput> inputsOf(VideoGenSpec spec) {
        List<VideoStudioJobInput> out = new ArrayList<>();
        if (spec.firstFrameKey() != null) {
            out.add(new VideoStudioJobInput(JusuanH3Contract.MEDIA_IMAGE, "首帧", fileStorage.signedUrl(spec.firstFrameKey())));
        }
        if (spec.lastFrameKey() != null) {
            out.add(new VideoStudioJobInput(JusuanH3Contract.MEDIA_IMAGE, "尾帧", fileStorage.signedUrl(spec.lastFrameKey())));
        }
        List<String> labels = VideoGenSpec.referenceLabels(spec.references());
        for (int i = 0; i < spec.references().size(); i++) {
            VideoGenSpec.Reference r = spec.references().get(i);
            out.add(new VideoStudioJobInput(r.mediaType(), labels.get(i), fileStorage.signedUrl(r.key())));
        }
        return out;
    }

    /** queued → queued；submitting / generating → running；succeeded；failed。 */
    static String wireStatus(String jobStatus) {
        if (jobStatus == null) return "queued";
        return switch (jobStatus) {
            case "queued" -> "queued";
            case "succeeded" -> "succeeded";
            case "failed" -> "failed";
            default -> "running";
        };
    }

    private static String modeOfKind(String kind) {
        for (Map.Entry<String, String> e : MODE_KINDS.entrySet()) {
            if (e.getValue().equals(kind)) return e.getKey();
        }
        if (kind != null && kind.startsWith("studio-")) return kind.substring("studio-".length());
        return null;
    }

    private static String modelName(MaterialVideoJob job) {
        if (job.getProviderUsed() != null && !job.getProviderUsed().isBlank()) return job.getProviderUsed();
        if (job.getModelUsed() != null && !job.getModelUsed().isBlank()) return job.getModelUsed();
        return null;
    }

    private String signUrl(String url) {
        return url == null || url.isBlank() ? null : signer.maybeSign(url);
    }

    private JsonNode readTree(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode v = node == null ? null : node.get(field);
        return v == null || v.isNull() || !v.isValueNode() || v.asText().isBlank() ? null : v.asText();
    }

    private static String iso(OffsetDateTime t) {
        return t == null ? null : t.toString();
    }

    // ── 小工具 ────────────────────────────────────────────────────────────────

    /**
     * 去掉首尾空白。比 {@link String#strip()} 多认两种：不换行空格（U+00A0 等）和 BOM ——
     * 前端 {@code trim()} 会去掉它们，两边数出来的字数才对得上。
     */
    static String stripBlank(String s) {
        if (s == null) return "";
        int start = 0;
        int end = s.length();
        while (start < end) {
            int cp = s.codePointAt(start);
            if (!isBlank(cp)) break;
            start += Character.charCount(cp);
        }
        while (end > start) {
            int cp = s.codePointBefore(end);
            if (!isBlank(cp)) break;
            end -= Character.charCount(cp);
        }
        return s.substring(start, end);
    }

    private static boolean isBlank(int cp) {
        return Character.isWhitespace(cp) || Character.isSpaceChar(cp) || cp == 0xFEFF;
    }

    private static BusinessException inputInvalid(String message) {
        return BusinessException.badRequest("VIDEO_STUDIO_INPUT_INVALID", message);
    }

    private static String typeName(String mediaType) {
        return switch (mediaType == null ? "" : mediaType.toLowerCase(Locale.ROOT)) {
            case JusuanH3Contract.MEDIA_VIDEO -> "视频";
            case JusuanH3Contract.MEDIA_AUDIO -> "音频";
            default -> "图片";
        };
    }

    static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
