package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 短剧渲染服务（v0.65）：分镜「首帧」图像生成 + 「直出/动态」视频生成。
 *
 *  - 首帧：用途 {@link AiModelPurpose#IMAGE_GENERATION}（OpenAI images 兼容
 *    POST {baseUrl}/images/generations，response_format=url|b64_json），产物字节按
 *    AGENTS §4.7 经 {@link CdnUploader} 落 CDN（DB 真值 = cdnKey，URL 由 signer 派生），
 *    成功后按 action 定价扣积分（{@link CreditService#debit}）。
 *  - 视频：委派 celebrity 既有管线 {@link MaterialVideoJobService}（kind="drama-shot"，
 *    异步 submit + poll，自带 hold/commit/release 计费）。轮询复用
 *    /api/me/drama/episodes/jobs/{id}。
 *
 * 不静默兜底：未绑定端点 503 IMAGE_NOT_CONFIGURED / 调用失败 502 IMAGE_CALL_FAILED。
 */
@Service
public class DramaRenderService {

    private static final Logger log = LoggerFactory.getLogger(DramaRenderService.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    /** 首帧单价（积分）。与前端 FRAME_COST 对齐；后续可挪 admin 定价。 */
    public static final long FRAME_COST = 2L;

    private final AiModelInvocationService invocation;
    private final AiModelUsageService usage;
    private final UpstreamModelHttp upstreamHttp;
    private final MaterialVideoJobService videoJobs;
    private final CreditService creditService;
    private final CdnUploader cdnUploader;
    private final CdnUrlSigner signer;
    private final PlatformConfigService configs;
    private final PromptService promptService;
    private final DramaReferenceAssembler assembler;
    private final com.aistareco.aep.service.storage.StorageQuotaService storage;
    private final ObjectMapper om;
    /**
     * 出片模型下拉要带视频的有效时长区间 / 可出画幅（协议硬边界只有它知道）。
     * 依赖图：本类早已经 {@link MaterialVideoJobService} 间接依赖它，这里直连不引入新的环。
     * null 只出现在下面那个旧构造器（单测用），此时视频选项退回「区间未知」。
     */
    private final MaterialVideoModelClient videoModels;

    /** 出图端点 → 它只认的固定画幅（上游 400「size must match preset … (WxH)」里学来的，进程内记住）。 */
    private final Map<String, ImageSize> sizePresets = new ConcurrentHashMap<>();

    @Autowired
    public DramaRenderService(AiModelInvocationService invocation,
                              AiModelUsageService usage,
                              UpstreamModelHttp upstreamHttp,
                              MaterialVideoJobService videoJobs,
                              CreditService creditService,
                              CdnUploader cdnUploader,
                              CdnUrlSigner signer,
                              PlatformConfigService configs,
                              PromptService promptService,
                              DramaReferenceAssembler assembler,
                              com.aistareco.aep.service.storage.StorageQuotaService storage,
                              ObjectMapper om,
                              MaterialVideoModelClient videoModels) {
        this.invocation = invocation;
        this.usage = usage;
        this.upstreamHttp = upstreamHttp;
        this.videoJobs = videoJobs;
        this.creditService = creditService;
        this.cdnUploader = cdnUploader;
        this.signer = signer;
        this.configs = configs;
        this.promptService = promptService;
        this.assembler = assembler;
        this.storage = storage;
        this.om = om;
        this.videoModels = videoModels;
    }

    /**
     * 出图 / 出片提示词服务端化（v0.72）：模板存 PromptService（admin「短剧专区 · 提示词设置」可改），
     * 前端只传结构化字段（vars）+ kind（shot=工作台分镜 / short=短视频分镜）选模板。
     * §8.0：模板未配置（origin=code）即报错，不静默兜底。过渡期仍兼容旧客户端直接传 prompt。
     */
    /** 首帧出图按 kind 选提示词：shot 人物分镜首帧 / short 短视频 / scene 空景场景参考 / character 角色定妆参考。 */
    private static String frameKeyForKind(String kind) {
        return switch (kind == null ? "shot" : kind) {
            case "short" -> PromptService.KEY_DRAMA_SHORT_FRAME_IMAGE;
            case "scene" -> PromptService.KEY_DRAMA_SCENE_FRAME_IMAGE;
            case "character" -> PromptService.KEY_DRAMA_CHARACTER_FRAME_IMAGE;
            default -> PromptService.KEY_DRAMA_FRAME_IMAGE;
        };
    }

    private String buildMediaPrompt(JsonNode body, String key) {
        String legacy = text(body, "prompt");
        if (legacy != null && !legacy.isBlank()) return legacy; // 过渡兼容；新前端走 vars
        Map<String, String> vars = new LinkedHashMap<>();
        JsonNode v = body.get("vars");
        if (v != null && v.isObject()) {
            v.fields().forEachRemaining(e ->
                    vars.put(e.getKey(), e.getValue() == null || e.getValue().isNull() ? "" : e.getValue().asText()));
        }
        return fillMediaPrompt(key, vars, orDefault(text(body, "kind"), "shot"));
    }

    /**
     * 按模板 key 填出图 / 出片提示词。renderFrame / renderClip 与画布出图 / 出视频（v0.198）共用这一个漏斗，
     * 规则只写在这里（§8.0.1 ④）。
     *
     * <p>§8.0：模板未配置（origin=code）即 503 {@code PROMPT_NOT_CONFIGURED}，不静默兜底。
     * 调用方应在冻结积分之前调它（画布在提交时就把最终提示词算好存进运行记录）。
     *
     * @param kind 只进排查日志（shot / short / canvas-look …）
     */
    public String fillMediaPrompt(String key, Map<String, String> vars, String kind) {
        PromptService.ResolvedPrompt p = promptService.resolve(key);
        if (p == null || "code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "出首帧 / 生成视频用的提示词尚未配置（promptKey=" + key
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        Map<String, String> safe = vars == null ? Map.of() : vars;
        // fill 后清掉未填充的残留占位符，避免把 {{x}} 原样喂给图像/视频模型
        String finalPrompt = PromptService.fill(p.userTemplate(), safe).replaceAll("\\{\\{[^}]*}}", "").trim();
        // 排查用：出图/出片拼装数据 + 最终发给模型的提示词全文（图像生成不走 ai-chat-io，这里兜底记录）。
        log.info("[drama-render] promptKey={} kind={} origin={} vars={} prompt={}", key, kind, p.origin(), safe, finalPrompt);
        return finalPrompt;
    }

    // ── 首帧（图像） ─────────────────────────────────────────────────────────────

    /**
     * body: { prompt, ratio?("9:16"|"16:9"|...), count?(1..4), ref_images?[] }
     * → { frames: [ { url, cdnKey } ... ], cost }
     */
    public JsonNode renderFrame(JsonNode body, String userId) {
        String prompt = buildMediaPrompt(body, frameKeyForKind(orDefault(text(body, "kind"), "shot")));
        if (prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先写这一镜的画面，再出首帧。");
        }
        // D-11：可选 endpoint_id（候选端点白名单）。传了 → 校验命中（未命中 503 ENDPOINT_NOT_ALLOWED，
        // 不扣费、不生成）；没传 → 默认端点（旧路径）。单价 override + capability(maxRefImages) 随命中的 candidate。
        ImagePlan plan = resolveImagePlan(text(body, "endpoint_id"), "出首帧");
        AiModelEndpoint ep = plan.endpoint();
        long cost = plan.cost();
        int count = clamp(body.path("count").asInt(1), 1, 4);
        String ratio = orDefault(text(body, "ratio"), "9:16");

        // 存储配额前置：已满则不生成、不扣费，提示清理或购买存储套餐（产物字节未知，按已用是否超额校验）。
        storage.checkQuota("drama", userId, 0);

        // C-3（一致性引擎 L1）：服务端参考装配。按 shot_ref（服务端自装配角色/场景/上一镜末帧）/ ref_slots /
        // ref_images（C-1 过渡兼容）三级入参装配真实资产，按端点 capability(maxRefImages) 裁剪，回报
        // applied_refs（role 升级为精确槽位）。valid 才喂给图像模型；本地 /cdn 标 local_unfetchable。
        // maxRefImages 未显式配置（null，含 D-11 seeder 回填的全部存量候选）→ legacy 兼容默认 6
        // （= v0.97 前端 slice(0,6) 既有上限）；按 1 会让升级当天多参考一致性整体削弱（回归修正）。
        DramaReferenceAssembler.FrameAssembly assembled = assembler.assembleFrame(body, userId,
                new DramaReferenceAssembler.Capability(plan.maxRefImages(), false, false));
        java.util.List<String> validRefs = assembled.imageRefs();
        int droppedCount = assembled.appliedRefs().path("requested").asInt() - assembled.appliedRefs().path("applied").asInt();
        if (droppedCount > 0) {
            log.warn("[drama-render] 跳过 {} 张未送达模型的参考图（本地/相对 URL 或超出端点参考上限；"
                    + "本地开发出图将少带参考图，生产 OSS https 不受影响）", droppedCount);
        }

        ArrayNode frames = om.createArrayNode();
        for (int i = 0; i < count; i++) {
            byte[] bytes = generateImageBytes(ep, prompt, ratio, validRefs);
            StoredImage stored = storeImageBytes(bytes, "drama/frames/", "首帧生成了但没保存下来，请再试一次。");
            storage.record("drama", userId, "分镜首帧", null, stored.key(), stored.bytes());
            ObjectNode f = om.createObjectNode();
            f.put("cdnKey", stored.key());
            f.put("url", signer.signKey(stored.key()));
            frames.add(f);
        }

        // 一次「首帧渲染」动作 = 固定单价（admin 短剧专区可配 / D-11 候选端点可 override），与版数解耦
        if (cost > 0) {
            creditService.debit(userId, cost, "DRAMA_FRAME",
                    "frame_" + UUID.randomUUID().toString().substring(0, 8),
                    "出首帧（" + count + " 版）");
        }
        log.info("[drama-render] frame ok user={} count={} endpoint={} ratio={}", userId, count, ep.getName(), ratio);

        ObjectNode out = om.createObjectNode();
        out.set("frames", frames);
        out.put("cost", cost);
        out.set("applied_refs", assembled.appliedRefs());
        return out;
    }

    // ── 出图积木（v0.198：renderFrame 与画布出图共用，不另写一份） ─────────────────────

    /** 出图计划：命中的端点 + 本次单价（每一「份」的价，与出几张的关系由调用方定）+ 参考图上限。 */
    public record ImagePlan(AiModelEndpoint endpoint, long cost, int maxRefImages) {}

    /**
     * 解析出图端点与单价，全部在生成与扣费之前抛：传了 endpointId → 必须命中候选白名单
     * （未命中 503 ENDPOINT_NOT_ALLOWED）；没传 → 默认端点（未绑定 503 IMAGE_NOT_CONFIGURED）。
     * 单价 = {@code drama.credit.frame}，命中的候选有 creditCostOverride 时以它为准。
     * 参考图上限 = 候选 maxRefImages；未配置 → legacy 6（{@link DramaReferenceAssembler#LEGACY_MAX_REF_IMAGES}）。
     *
     * @param action 报错文案里的动作（「出首帧」「出图」），只影响提示语
     */
    public ImagePlan resolveImagePlan(String endpointId, String action) {
        AiModelInvocationService.ResolvedEndpoint resolved;
        if (endpointId != null && !endpointId.isBlank()) {
            resolved = invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION, endpointId)
                    .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "ENDPOINT_NOT_ALLOWED",
                            "选的模型现在用不了，刷新页面后重新选一个。"));
        } else {
            resolved = invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION, null)
                    .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED",
                            action + "还没接入图像模型：请在管理后台为「图像生成」用途绑定一个模型端点后再试。"));
        }
        long cost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_FRAME, FRAME_COST);
        AiAppEndpointCandidate candidate = resolved.candidate();
        if (candidate != null && candidate.getCreditCostOverride() != null) {
            cost = candidate.getCreditCostOverride();
        }
        int maxRefImages = candidate != null && candidate.getMaxRefImages() != null
                ? candidate.getMaxRefImages() : DramaReferenceAssembler.LEGACY_MAX_REF_IMAGES;
        return new ImagePlan(resolved.endpoint(), cost, maxRefImages);
    }

    /**
     * 调一次图像模型拿到图片字节（**不存、不计费**）。失败抛 502 IMAGE_CALL_FAILED / IMAGE_BAD_OUTPUT，
     * 端点只认固定画幅且比例对不上时抛 400 IMAGE_SIZE_UNSUPPORTED（上游状态码与响应体由 UpstreamModelHttp
     * 记进日志，internalDetail 里也有，§8.0.1 ①）。
     *
     * @param refUrls 已过滤为外部模型可抓取的绝对 http(s) 地址（本地 /cdn 相对路径要调用方剔掉）
     */
    public byte[] generateImageBytes(AiModelEndpoint ep, String prompt, String ratio, List<String> refUrls) {
        return callImageModel(ep, prompt, ratioToSize(orDefault(ratio, "9:16")), refUrls);
    }

    /** 一张已经存进我方存储的生成图（还没记账；记 storage_asset 由调用方做 —— 首帧记用量、画布记归属）。 */
    public record StoredImage(String key, long bytes, String contentType) {}

    /**
     * 把图片字节存进我方存储，返回 key。存不下来抛 502 IMAGE_STORE_FAILED（提示语用 storeFailMessage）。
     *
     * <p>存储格式按**字节**判（§8.0.1 ⑤）：厂商常给 JPEG，以前一律顶着 .png / image/png 落库，
     * 浏览器自己嗅探看不出问题，转交给另一个厂商时才被拒。认不出的字节才沿用 png（与改动前一致）。
     *
     * @param keyPrefix 以 / 结尾的 key 前缀（如 {@code drama/frames/}）
     */
    public StoredImage storeImageBytes(byte[] bytes, String keyPrefix, String storeFailMessage) {
        com.aistareco.aep.service.storage.ImageBytes.Format fmt = com.aistareco.aep.service.storage.ImageBytes.sniff(bytes);
        String ext = fmt != null ? fmt.ext() : "png";
        String mime = fmt != null ? fmt.mime() : "image/png";
        String key = keyPrefix + UUID.randomUUID().toString().replace("-", "") + "." + ext;
        try {
            Path tmp = Files.createTempFile("drama-image-", "." + ext);
            try {
                Files.write(tmp, bytes);
                cdnUploader.upload(tmp, key, mime);
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (Exception e) {
            log.warn("[drama-render] 生成图存储失败 key={} bytes={} err={}", key, bytes == null ? 0 : bytes.length, e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_STORE_FAILED", storeFailMessage);
        }
        return new StoredImage(key, bytes == null ? 0 : bytes.length, mime);
    }

    /**
     * OpenAI images 兼容调用：data[0].url（下载）或 b64_json（解码）→ 图像字节。
     * validRefs 已由 {@link #computeFrameAppliedRefs} 过滤为外部模型可抓取的绝对 http(s) URL。
     *
     * <p>固定画幅端点（2026-10-03 生产实测：聚算 ernie-Image 只认 768×768，其它尺寸一律
     * 400「size must match preset image_standard_square_1x (768x768)」）：
     * <ol>
     *   <li>上游这样拒过一次，就按端点记住它的画幅（进程内，换了 model / baseUrl 就不算同一个）；</li>
     *   <li>要的比例和它的一致（2% 以内）→ 按它的尺寸重发<b>一次</b>；不一致 → 400 IMAGE_SIZE_UNSUPPORTED，
     *       明说只能出什么比例，让用户换模型或改画幅 —— 不偷偷出一张比例不对的图；</li>
     *   <li>记住之后：比例对得上就直接发它的尺寸，对不上不发请求、直接报同一个错。</li>
     * </ol>
     * 本方法不计费；调用方在它抛异常时都不扣（首帧在成功后才 debit，三视图 / 画布按张 commit、其余退冻结）。
     */
    private byte[] callImageModel(AiModelEndpoint ep, String prompt, String size, java.util.List<String> validRefs) {
        ImageSize requested = ImageSize.parse(size);
        ImageSize known = sizePresets.get(presetKey(ep));
        String firstSize = size;
        if (known != null) {
            if (requested != null && !requested.sameRatio(known)) throw sizeUnsupported(ep, known, requested);
            firstSize = known.wire();
        }
        try {
            return callImageModelOnce(ep, prompt, firstSize, validRefs, true);
        } catch (PresetRejected rejected) {
            ImageSize preset = rejected.preset();
            if (requested != null && !requested.sameRatio(preset)) throw sizeUnsupported(ep, preset, requested);
            // 已经按它说的尺寸发过了还被这样拒：不再兜圈子，把上游原话交出去
            if (preset.wire().equals(firstSize)) throw rejected.callFailed();
            log.info("[drama-render] 端点只认固定画幅，按它重发一次 endpoint={} preset={} requested={}",
                    ep.getName(), preset.wire(), firstSize);
            return callImageModelOnce(ep, prompt, preset.wire(), validRefs, false);
        }
    }

    /**
     * 发一次出图请求。{@code detectPreset}=true 时，400「size must match preset」抛 {@link PresetRejected}
     * 交给 {@link #callImageModel} 决定重发还是报错；false（已经重发过）时按普通 4xx 处理。两种情况都会记住画幅。
     */
    private byte[] callImageModelOnce(AiModelEndpoint ep, String prompt, String size, java.util.List<String> validRefs,
                                      boolean detectPreset) {
        String requestId = "img-" + UUID.randomUUID().toString().substring(0, 16);
        long startNanos = System.nanoTime();
        try {
            ObjectNode req = om.createObjectNode();
            req.put("model", ep.getModel());
            req.put("prompt", prompt);
            if (size != null) req.put("size", size);
            ObjectNode extra = req.putObject("extra_body");
            extra.put("response_format", "url");
            // 参考图已在上游 computeFrameAppliedRefs 过滤为外部模型可抓取的绝对 http(s) URL
            // （本地 fake-CDN 的 /cdn/… 相对路径 / localhost 已被剔除并计入 applied_refs 回报）。
            if (validRefs != null && !validRefs.isEmpty()) {
                ArrayNode arr = extra.putArray("image");
                validRefs.forEach(arr::add);
            }
            String apiKey = AepCryptoUtil.decrypt(ep.getUpstreamApiKeyEncrypted());
            URI uri = URI.create(rstrip(ep.getBaseUrl()) + "/images/generations");
            HttpRequest httpReq = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(120))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(req)))
                    .build();
            // v0.85：发送 + 原始日志 + 非 2xx WARN + 失败用量统一走共享原语。
            // 请求体也要进 [upstream-io] REQUEST（§8.0.1 ①）；参考图是签名地址，日志里去掉签名。
            ModelCallCtx ctx = ModelCallCtx.builder(AiModelPurpose.IMAGE_GENERATION)
                    .endpoint(ep.getId(), ep.getName())
                    .model(ep.getModel())
                    .requestId(requestId)
                    .requestBodyJson(requestBodyForLog(req))
                    .client(HTTP)
                    .build();
            HttpResponse<String> resp;
            try {
                resp = upstreamHttp.sendJson(httpReq, ctx);
            } catch (UpstreamCallException ex) {
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图片没生成出来，稍后再试一次",
                        "endpoint=" + ep.getName() + " err=" + ex.getCause());
            }
            if (resp.statusCode() / 100 != 2) {
                BusinessException failed = upstreamRejected(ep.getName(), ep.getModel(), resp.statusCode(), resp.body());
                ImageSize preset = resp.statusCode() == 400 ? sizePresetHint(resp.body()) : null;
                if (preset != null) {
                    rememberSizePreset(ep, preset);
                    if (detectPreset) throw new PresetRejected(preset, failed);
                }
                throw failed;
            }
            String upstreamId = null;
            byte[] bytes;
            try {
                JsonNode root = om.readTree(resp.body());
                upstreamId = root.path("id").asText(null);
                JsonNode data0 = root.path("data").path(0);
                String url = data0.path("url").asText(null);
                if (url != null && !url.isBlank()) {
                    bytes = download(url);
                } else {
                    String b64 = data0.path("b64_json").asText(null);
                    if (b64 == null || b64.isBlank()) {
                        upstreamHttp.recordBadOutput(ctx, resp.body(), "IMAGE_BAD_OUTPUT", elapsedMs(startNanos));
                        throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_BAD_OUTPUT",
                                "这次没拿到图片，再试一次。");
                    }
                    bytes = Base64.getDecoder().decode(b64);
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                // 2xx 之后的处理（解析 / 下载产物 / 解码）失败：记一条失败用量后转业务错误。
                usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                        AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                        requestId, upstreamId, elapsedMs(startNanos), e.getClass().getSimpleName(), e.getMessage());
                log.warn("[drama-render] image post-process failed: {}", e.toString());
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                        "图片没生成出来，稍后再试一次",
                        "endpoint=" + ep.getName() + " err=" + e);
            }
            // 用量观测（best-effort，token 数图像接口通常不回）
            try {
                usage.recordMeteredObserved(ep.getId(), ep.getName(), ep.getModel(),
                        AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L,
                        AiModelBillingMode.PER_CALL, 1L, 0L, true,
                        requestId, upstreamId, elapsedMs(startNanos), null, null);
            } catch (Exception ignore) { /* 观测旁路，不阻塞主链路 */ }
            return bytes;
        } catch (BusinessException | PresetRejected e) {
            throw e;
        } catch (Exception e) {
            // 仅覆盖发送前的准备阶段（序列化 / URI 构造等）；发送及之后的失败已在内层处理。
            usage.recordObserved(ep.getId(), ep.getName(), ep.getModel(),
                    AiModelPurpose.IMAGE_GENERATION.name(), 0L, 0L, 0L, false,
                    requestId, null, elapsedMs(startNanos), e.getClass().getSimpleName(), e.getMessage());
            log.warn("[drama-render] image call failed: {}", e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED",
                    "图片没生成出来，稍后再试一次",
                    "endpoint=" + ep.getName() + " err=" + e);
        }
    }

    // ── 出图：固定画幅 / 上游拒绝的原话 / 请求体日志 ─────────────────────────────────

    /** 上游报的固定画幅，如 {@code size must match preset image_standard_square_1x (768x768)}。 */
    private static final Pattern SIZE_PRESET_HINT =
            Pattern.compile("(?i)size must match preset\\s+\\S+\\s*\\((\\d+)\\s*[x×]\\s*(\\d+)\\)");
    /** 响应体被截断、整段解析不了 JSON 时，退一步找第一个 "message":"…" 字段。 */
    private static final Pattern JSON_MESSAGE_FIELD = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
    /** 上游原话里像密钥的片段（sk-… / key=… / Bearer …）打码后再给用户看。与画布 worker 同口径。 */
    private static final Pattern SECRET_LIKE = Pattern.compile("(?i)(sk-|key[=:]\\s*|bearer\\s+)[A-Za-z0-9._-]{8,}");
    /** internalDetail 里留多少响应体：要够画布 worker 整段解析出 JSON（以前 300 字把它截坏了）。 */
    static final int INTERNAL_BODY_LIMIT = 1000;
    /** 给用户看的上游原话最多多长。 */
    static final int UPSTREAM_MESSAGE_LIMIT = 120;
    /** 要的比例和端点固定画幅的比例相差多少以内算一致。 */
    private static final double RATIO_TOLERANCE = 0.02;

    /** 一个画幅（宽 × 高，像素）。 */
    record ImageSize(int width, int height) {
        /** "720x1280" / "768×768" → 画幅；空 / 认不出 → null。 */
        static ImageSize parse(String s) {
            if (s == null) return null;
            String[] parts = s.trim().toLowerCase().split("[x×*]");
            if (parts.length != 2) return null;
            try {
                int w = Integer.parseInt(parts[0].trim());
                int h = Integer.parseInt(parts[1].trim());
                return w > 0 && h > 0 ? new ImageSize(w, h) : null;
            } catch (NumberFormatException e) {
                return null;
            }
        }

        /** 发给上游的写法：{@code 768x768}。 */
        String wire() {
            return width + "x" + height;
        }

        /** 约分后的比例：768x768 → 1:1，720x1280 → 9:16。 */
        String ratioLabel() {
            int g = gcd(width, height);
            return (width / g) + ":" + (height / g);
        }

        boolean sameRatio(ImageSize o) {
            double mine = (double) width / height;
            double theirs = (double) o.width / o.height;
            return Math.abs(mine - theirs) / theirs <= RATIO_TOLERANCE;
        }

        private static int gcd(int a, int b) {
            return b == 0 ? a : gcd(b, a % b);
        }
    }

    /** 上游 400 说只认某个固定画幅；带着按普通 4xx 准备好的错误，重发不成时直接抛它。 */
    private static final class PresetRejected extends RuntimeException {
        private final ImageSize preset;
        private final BusinessException callFailed;

        PresetRejected(ImageSize preset, BusinessException callFailed) {
            super("size preset " + preset.wire(), null, false, false);
            this.preset = preset;
            this.callFailed = callFailed;
        }

        ImageSize preset() { return preset; }
        BusinessException callFailed() { return callFailed; }
    }

    /** 画幅记忆按「端点 + 模型 + 地址」区分：后台把同一个端点改成别的模型后，旧的画幅不该再拦它。 */
    private static String presetKey(AiModelEndpoint ep) {
        return ep.getId() + "|" + ep.getModel() + "|" + ep.getBaseUrl();
    }

    private void rememberSizePreset(AiModelEndpoint ep, ImageSize preset) {
        ImageSize before = sizePresets.put(presetKey(ep), preset);
        if (!preset.equals(before)) {
            log.info("[drama-render] 记下端点固定画幅 endpoint={} model={} preset={}（下次直接按它发）",
                    ep.getName(), ep.getModel(), preset.wire());
        }
    }

    /** 400 响应体里的固定画幅；没有 → null。 */
    static ImageSize sizePresetHint(String body) {
        if (body == null) return null;
        Matcher m = SIZE_PRESET_HINT.matcher(body);
        if (!m.find()) return null;
        try {
            int w = Integer.parseInt(m.group(1));
            int h = Integer.parseInt(m.group(2));
            return w > 0 && h > 0 ? new ImageSize(w, h) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 端点只出固定画幅、而要的比例对不上：400，明说它能出什么、用户能怎么办。
     * internalDetail 故意不带 {@code status=}：画布 worker 见到 status=4xx 会改用上游原话，这里要的是这句话本身。
     */
    private static BusinessException sizeUnsupported(AiModelEndpoint ep, ImageSize preset, ImageSize requested) {
        String ratio = preset.ratioLabel();
        return BusinessException.wrapped(HttpStatus.BAD_REQUEST, "IMAGE_SIZE_UNSUPPORTED",
                "「" + ep.getName() + "」只能出 " + preset.width() + "×" + preset.height() + "（" + ratio
                        + "）的图。换一个出图模型，或者把画幅改成 " + ratio + " 再试。",
                "endpoint=" + ep.getName() + " preset=" + preset.wire() + " requested=" + requested.wire());
    }

    /**
     * 上游非 2xx → 502 IMAGE_CALL_FAILED（错误码不变，调用方照旧按它处理）。
     * 4xx 把上游原话（打码、截断）说给用户 —— 是我们的请求哪儿不对，重试不会好；
     * 5xx 笼统说，细节在日志和 internalDetail（格式 {@code endpoint=… model=… status=NNN body=…}，画布 worker 按它解析）。
     */
    static BusinessException upstreamRejected(String endpointName, String model, int status, String body) {
        String detail = "endpoint=" + endpointName + " model=" + model + " status=" + status
                + " body=" + truncate(body, INTERNAL_BODY_LIMIT);
        String message;
        if (status >= 400 && status < 500) {
            String up = upstreamMessage(body);
            message = up == null ? "出图模型拒绝了这次请求（" + status + "）。" : "出图模型拒绝了这次请求：" + up;
        } else {
            message = "图片没生成出来，稍后再试一次";
        }
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "IMAGE_CALL_FAILED", message, detail);
    }

    /**
     * 从上游错误体里取那句话：{@code error.message} / {@code message} / 字符串形态的 {@code error}；
     * 整段不是合法 JSON（被截断）时找第一个 {@code "message":"…"}。HTML 错误页之类取不出 → null（不外泄）。
     */
    static String upstreamMessage(String body) {
        if (body == null || body.isBlank()) return null;
        String msg = null;
        try {
            JsonNode root = JSON.readTree(body);
            for (JsonNode c : new JsonNode[]{root.path("error").path("message"), root.path("message"), root.path("error")}) {
                if (c.isTextual() && !c.asText().isBlank()) {
                    msg = c.asText();
                    break;
                }
            }
        } catch (Exception ignore) {
            // 不是完整 JSON：下面按字段找
        }
        if (msg == null) {
            Matcher m = JSON_MESSAGE_FIELD.matcher(body);
            if (m.find()) {
                try {
                    msg = JSON.readValue("\"" + m.group(1) + "\"", String.class);
                } catch (Exception e) {
                    msg = m.group(1);
                }
            }
        }
        if (msg == null || msg.isBlank()) return null;
        msg = SECRET_LIKE.matcher(msg.strip()).replaceAll("$1***");
        return truncate(msg, UPSTREAM_MESSAGE_LIMIT);
    }

    /** 记进 [upstream-io] 的请求体：参考图地址去掉查询串（签名不进日志），其余原样。 */
    private String requestBodyForLog(ObjectNode req) {
        try {
            ObjectNode copy = req.deepCopy();
            JsonNode images = copy.path("extra_body").path("image");
            if (images instanceof ArrayNode arr) {
                for (int i = 0; i < arr.size(); i++) {
                    arr.set(i, TextNode.valueOf(withoutQuery(arr.get(i).asText(""))));
                }
            }
            return om.writeValueAsString(copy);
        } catch (Exception e) {
            return null; // 只影响日志
        }
    }

    static String withoutQuery(String url) {
        if (url == null) return "";
        int cut = url.length();
        int q = url.indexOf('?');
        if (q >= 0) cut = q;
        int hash = url.indexOf('#');
        if (hash >= 0 && hash < cut) cut = hash;
        return url.substring(0, cut);
    }

    private static byte[] download(String url) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60)).GET().build();
        HttpResponse<byte[]> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (resp.statusCode() / 100 != 2 || resp.body() == null || resp.body().length == 0) {
            throw new IllegalStateException("download " + resp.statusCode());
        }
        if (resp.body().length > 64 * 1024 * 1024) throw new IllegalStateException("image too large");
        return resp.body();
    }

    // ── 视频（直出 / 动态） ───────────────────────────────────────────────────────

    /**
     * body: { prompt, name?, duration_sec?, ratio?, project_id?, shot_id?, frame_url?(首帧参考) }
     * → 视频任务卡（轮询走 /api/me/drama/episodes/jobs/{id}）。
     */
    public JsonNode renderClip(JsonNode body, String userId) {
        String prompt = buildMediaPrompt(body,
                "short".equals(orDefault(text(body, "kind"), "shot"))
                        ? PromptService.KEY_DRAMA_SHORT_CLIP_VIDEO
                        : PromptService.KEY_DRAMA_CLIP_VIDEO);
        if (prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先写这一镜的画面，再生成视频。");
        }
        // 存储配额前置：已满则不提交任务、不 hold 积分（成片字节出片后由 worker 记账）。
        storage.checkQuota("drama", userId, 0);
        int durationSec = clamp(body.path("duration_sec").asInt(5), 2, 60);
        String ratio = orDefault(text(body, "ratio"), "9:16");
        String name = orDefault(text(body, "name"), "短剧分镜");
        String projectId = text(body, "project_id");
        String sceneId = text(body, "scene_id");
        String shotId = text(body, "shot_id");
        String target = text(body, "target");

        // D-11：可选 endpoint_id（视频候选端点白名单）。传了 → 校验命中（未命中 503 ENDPOINT_NOT_ALLOWED，
        // 不提交任务、不 hold 积分）；命中的 candidate 单价 override 覆盖 drama.credit.clip，并把 endpoint_id
        // 随 item 存 variant_config 透传到 worker（§6.4 四层串联）；没传 → 默认端点（旧路径完全不变）。
        ClipPlan plan = resolveClipPlan(text(body, "endpoint_id"), durationSec);

        // C-3：服务端参考装配（视频线）。shot_ref 时服务端派生首/末帧（本镜已锁首帧 → 同场上一镜真实末帧；
        // 本镜末帧 → 同场下一镜开场首帧），无 shot_ref 时退回显式 frame_url/last_frame_url。
        // clip 线只用首/末帧两槽；maxRefImages=0 明确表示当前适配仅开放 t2v，首帧也不得误报已送达。
        DramaReferenceAssembler.ClipAssembly assembled = assembler.assembleClip(body, userId, plan.capability());

        ObjectNode vc = om.createObjectNode();
        vc.put("target", orDefault(target, orDefault(text(body, "kind"), "shot")));
        if (sceneId != null && !sceneId.isBlank()) vc.put("scene_id", sceneId);
        if (shotId != null && !shotId.isBlank()) vc.put("shot_id", shotId);
        if (body != null && body.hasNonNull("episode_no")) vc.put("episode_no", body.path("episode_no").asInt());

        // 短剧按 app 维度独立定价（drama.credit.clip，D-11 候选端点可 override），不耦合带货线 material.video-generate。
        // firstFrameKey 这里仍传 null：工作台这条线漏写 first_frame_key 是已知老问题（TODO），不在 v0.198 范围。
        JsonNode card = submitClip(plan, new ClipSubmission("drama-shot", name, "短剧镜头视频", prompt,
                assembled.firstFrameUrl(), assembled.lastFrameUrl(), null, durationSec, ratio, projectId, vc), userId);
        log.info("[drama-render] clip queued user={} project={} dur={}s", userId, projectId, durationSec);

        // C-1/C-3：首/末帧生效情况回报（applied_refs，role=first_frame/last_frame）——末帧是否送达取决于
        // 视频端点是否支持首尾帧关键帧（seedance / generic best-effort 支持；agnes 仅首帧）。纯做如实回报。
        if (card instanceof ObjectNode on) {
            on.set("applied_refs", assembled.appliedRefs());
        }
        return card;
    }

    // ── 出视频积木（v0.198：renderClip 与画布出视频共用，不另写一份） ─────────────────────

    /**
     * 出视频计划：端点 id（null = worker 回落默认端点）+ 命中的端点（可空）+ 本次冻结额（候选 override，
     * 端点 PER_SECOND 时按秒 × 时长）+ 参考能力。{@link #resolveClipPlan} 产出时协议级校验已经做完。
     */
    public record ClipPlan(String endpointId, AiModelEndpoint endpoint, long cost, Integer maxRefImages,
                           boolean supportsFirstLastFrame, boolean supportsSubjectReference) {
        /** clip 线参考装配能力：maxRefImages 未配置 → legacy 6；=0 表示这个候选只开放文生视频。 */
        public DramaReferenceAssembler.Capability capability() {
            return new DramaReferenceAssembler.Capability(
                    maxRefImages != null ? maxRefImages : DramaReferenceAssembler.LEGACY_MAX_REF_IMAGES,
                    supportsFirstLastFrame, supportsSubjectReference);
        }

        /** 这个候选收不收首帧（maxRefImages=0 明确表示只开放文生视频；未配置按收）。 */
        public boolean acceptsFirstFrame() {
            return maxRefImages == null || maxRefImages > 0;
        }
    }

    /**
     * 解析出视频端点、单价与能力，全部在提交（= hold）之前抛：
     * 传了 endpointId 未命中候选 → 503 ENDPOINT_NOT_ALLOWED；超候选时长上限 → 400 VIDEO_DURATION_UNSUPPORTED；
     * 协议硬边界（H3 = 5..15 秒）/ API Key → {@code MaterialVideoJobService.validateRequest}。
     * 没传 endpointId → 默认端点不强制存在（worker 提交时解析），这里只取能力与单价。
     */
    public ClipPlan resolveClipPlan(String endpointId, int durationSec) {
        boolean explicit = endpointId != null && !endpointId.isBlank();
        long clipCost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_CLIP, 30);
        AiModelEndpoint chosenVideoEp = null;
        Integer capMaxRefImages = null;
        Boolean capFirstLastFrame = null;
        Boolean capSubjectReference = null;
        AiModelInvocationService.ResolvedEndpoint resolved = explicit
                ? invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, endpointId)
                        .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "ENDPOINT_NOT_ALLOWED",
                                "选的模型现在用不了，刷新页面后重新选一个。"))
                // 默认端点：不强制存在（worker 提交时解析；此处仅取 capability 用于首尾帧判定与 applied_refs 回报）。
                : invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null).orElse(null);
        if (resolved != null) {
            chosenVideoEp = resolved.endpoint();
            AiAppEndpointCandidate candidate = resolved.candidate();
            if (candidate != null) {
                if (candidate.getMaxDurationSec() != null && durationSec > candidate.getMaxDurationSec()) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_DURATION_UNSUPPORTED",
                            (explicit ? "选的" : "默认的") + "视频模型一条最长 " + candidate.getMaxDurationSec()
                                    + " 秒，把这一镜的时长改短一点再试。");
                }
                clipCost = effectiveVideoCreditCost(chosenVideoEp, candidate, durationSec, clipCost);
                capMaxRefImages = candidate.getMaxRefImages();
                capFirstLastFrame = candidate.getSupportsFirstLastFrame();
                capSubjectReference = candidate.getSupportsSubjectReference();
            }
        }
        // 协议级失败快（H3=5..15 秒）+ API Key 有效性检查，必须发生在 hold 积分之前。
        videoJobs.validateRequest(explicit ? endpointId : null, durationSec);
        // 首尾帧能力：候选显式 supportsFirstLastFrame 最高优先；未配置（null，含 seeder 回填存量候选）
        // → C-1 协议关键字静态判定兜底（seedance/generic 支持、agnes 仅首帧），不一律 false（回归修正口径）。
        boolean flf = capFirstLastFrame != null ? capFirstLastFrame : supportsFirstLastFrame(chosenVideoEp);
        return new ClipPlan(explicit ? endpointId : null, chosenVideoEp, clipCost, capMaxRefImages, flf,
                capSubjectReference != null ? capSubjectReference : false);
    }

    /**
     * 一条要提交的短剧视频。
     *
     * @param firstFrameUrl 首帧地址：拼进提示词标记（seedance / agnes / generic 从标记里抽）；没有传 null
     * @param firstFrameKey 首帧的**本人**存储 key：写进 variant_config.first_frame_key（聚算 H3 只认它）；没有传 null
     * @param variantConfig 业务自己的 variant_config（target / shot_id…）；endpoint_id 与 first_frame_key 由 submitClip 补
     */
    public record ClipSubmission(String kind, String name, String creditLabel, String prompt,
                                 String firstFrameUrl, String lastFrameUrl, String firstFrameKey,
                                 int durationSec, String ratio, String scriptId, ObjectNode variantConfig) {}

    /**
     * 构建 item 并提交 {@link MaterialVideoJobService#submit}（{@code APP_DRAMA}；提交即冻结、worker 结算或退回）。
     * 单价用 {@code plan.cost()}（item.credit_cost）—— 报价、冻结、结算同一个数。
     *
     * @return 视频任务卡（MaterialVideo 形状）；没建出任务时是空对象（调用方判 {@code id}）
     */
    public JsonNode submitClip(ClipPlan plan, ClipSubmission s, String userId) {
        StringBuilder full = new StringBuilder(s.prompt());
        if (s.firstFrameUrl() != null && !s.firstFrameUrl().isBlank()) {
            full.append("\n（严格基于该首帧画面延展动态：").append(s.firstFrameUrl()).append("）");
        }
        // v0.97 P2：尾帧（来自下一镜首帧 / decompose 末帧）→ seedance 双关键帧插值；
        // 视频客户端按协议抽出（seedance content[role=last_frame] / generic end_image），
        // 下游不支持则忽略不报错（§8.0：传入不生效 ≠ 静默伪造）。
        if (s.lastFrameUrl() != null && !s.lastFrameUrl().isBlank()) {
            full.append("\n（并以该画面作为结尾帧：").append(s.lastFrameUrl()).append("）");
        }

        ObjectNode item = om.createObjectNode();
        item.put("kind", s.kind());
        item.put("credit_cost", plan.cost());
        item.put("credit_label", s.creditLabel());
        item.put("name", s.name());
        item.put("prompt", full.toString());
        item.put("duration_sec", s.durationSec());
        item.put("aspect_ratio", s.ratio());
        if (s.scriptId() != null && !s.scriptId().isBlank()) item.put("script_id", s.scriptId());
        ObjectNode vc = s.variantConfig() != null ? s.variantConfig().deepCopy() : om.createObjectNode();
        // D-11：指定的候选端点随 item 透传到 worker（MaterialVideoWorker → MaterialVideoModelClient.pickEndpoint）；
        // 缺省时不写此键 → worker 回落默认端点（celebrity 素材线默认路径完全不变）。
        if (plan.endpointId() != null) vc.put("endpoint_id", plan.endpointId());
        // 聚算 H3 把提示词里的首帧标记剥掉、只认 variant_config.first_frame_key（先把图传上去换 assetId）。
        if (s.firstFrameKey() != null && !s.firstFrameKey().isBlank()) vc.put("first_frame_key", s.firstFrameKey());
        item.set("variant_config", vc);
        ObjectNode submit = om.createObjectNode();
        submit.putArray("items").add(item);

        List<JsonNode> jobs = videoJobs.submit(submit, userId, MaterialVideoJobService.APP_DRAMA);
        return jobs.isEmpty() ? om.createObjectNode() : jobs.get(0);
    }

    // ── C-2：角色多角度参考图集出图（供 DramaAssetService 的三视图端点编排） ──────────

    /**
     * C-2 三视图 hold 前的 §8.0 前置校验：图像端点未配 503 IMAGE_NOT_CONFIGURED / 提示词未配
     * 503 PROMPT_NOT_CONFIGURED（均在 hold 之前抛，故不冻结、不扣费）；存储配额前置。
     * 调用方（DramaAssetService）在 creditService.hold 之前调用。
     */
    public void preflightCharacterReferenceSheet(String userId) {
        invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION)
                .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED",
                        "生成角色参考图还没接入图像模型：请在管理后台为「图像生成」用途绑定一个模型端点后再试。"));
        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_CHARACTER_FRAME_IMAGE);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "角色定妆照用的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_CHARACTER_FRAME_IMAGE
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        storage.checkQuota("drama", userId, 0);
    }

    /**
     * C-2：单张角色参考图出图（复用 IMAGE_GENERATION 默认端点 + character 定妆提示词），返回 CDN
     * object key（§4.7.4 真值）。<b>不计费</b>——批量计费由调用方 hold→commit 编排（部分成功部分退）。
     * vars 由调用方拼好（含 name/descClause/styleSuffix/angleClause，angleClause 注入拍摄角度）；
     * lockRefImages 用角色已有定妆图锁脸（本地/相对 URL 会被过滤，仅生产 OSS https 生效）。
     * §8.0 与 preflight 同口径：端点/提示词未配 503（应在 hold 前由 preflight 拦下，这里兜底）。
     */
    public String renderCharacterReferenceFrame(String userId, Map<String, String> vars,
                                                String ratio, List<String> lockRefImages) {
        AiModelEndpoint ep = invocation.resolveEndpoint(AiModelPurpose.IMAGE_GENERATION)
                .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "IMAGE_NOT_CONFIGURED",
                        "生成角色参考图还没接入图像模型：请在管理后台为「图像生成」用途绑定一个模型端点后再试。"));
        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_CHARACTER_FRAME_IMAGE);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "角色定妆照用的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_CHARACTER_FRAME_IMAGE + "）。");
        }
        String prompt = PromptService.fill(p.userTemplate(), vars == null ? Map.of() : vars)
                .replaceAll("\\{\\{[^}]*}}", "").trim();
        if (prompt.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROMPT_REQUIRED", "请先写这个角色的外貌，再生成参考图。");
        }
        storage.checkQuota("drama", userId, 0);
        ArrayNode refArr = om.createArrayNode();
        if (lockRefImages != null) {
            for (String u : lockRefImages) if (u != null && !u.isBlank()) refArr.add(u);
        }
        List<String> validRefs = computeFrameAppliedRefs(refArr).validUrls();
        byte[] bytes = callImageModel(ep, prompt, ratioToSize(orDefault(ratio, "9:16")), validRefs);
        String key = "drama/char-refs/" + UUID.randomUUID().toString().replace("-", "") + ".png";
        try {
            Path tmp = Files.createTempFile("drama-charref-", ".png");
            try {
                Files.write(tmp, bytes);
                cdnUploader.upload(tmp, key, "image/png");
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_STORE_FAILED",
                    "参考图生成了但没保存下来，请再试一次。");
        }
        storage.record("drama", userId, "角色参考图", null, key, bytes.length);
        log.info("[drama-render] char-ref ok user={} endpoint={} key={}", userId, ep.getName(), key);
        return key;
    }

    // ── D-11：出片模型下拉（一用途多候选端点 + capability） ────────────────────────

    /**
     * 组装「出片模型」下拉数据：image = IMAGE_GENERATION 候选 / video = VIDEO_GENERATION 候选。
     * 仅含启用的候选 + 启用的端点；creditCost = candidate.override ?? 用途默认单价（frame / clip）。
     * capability 未配置（null）时按 legacy 兼容默认装配：maxRefImages→6（v0.97 前端既有上限）、
     * 首尾帧→协议关键字静态判定（非降级；applied_refs 会如实回报）。
     *
     * <p>视频选项带**有效**时长区间（协议硬边界 ∩ 候选配置，与提交时 {@code validateRequest} 同一个算法）
     * 和协议能出的画幅：聚算媒体协议 5–15 秒，下限只有协议知道，后台那张候选表里没有这一列 ——
     * 不给的话画布能建出 3–4 秒的片段，提交时才被拒。图片选项不变。
     */
    public com.aistareco.aep.dto.RenderModelsDto listRenderModels() {
        long frameCost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_FRAME, FRAME_COST);
        long clipCost = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_CLIP, 30);
        return new com.aistareco.aep.dto.RenderModelsDto(
                renderModelOptions(AiModelPurpose.IMAGE_GENERATION, frameCost),
                renderModelOptions(AiModelPurpose.VIDEO_GENERATION, clipCost));
    }

    private List<com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto> renderModelOptions(
            AiModelPurpose purpose, long defaultCost) {
        List<com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto> out = new java.util.ArrayList<>();
        for (AiModelInvocationService.ResolvedEndpoint r : invocation.listCandidates(purpose)) {
            if (!r.candidate().isEnabled() || !r.endpoint().isEnabled()) continue;
            long cost = r.candidate().getCreditCostOverride() != null ? r.candidate().getCreditCostOverride() : defaultCost;
            String billingUnit = candidateBillingUnit(purpose, r.endpoint(), r.candidate());
            com.aistareco.aep.dto.EndpointCapabilityDto capability = purpose == AiModelPurpose.VIDEO_GENERATION
                    ? videoCapability(r)
                    : com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate());
            out.add(new com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto(
                    r.endpoint().getId(),
                    r.endpoint().getName(),
                    r.isDefault(),
                    capability,
                    cost,
                    billingUnit));
        }
        return out;
    }

    /** 视频候选的能力 + 有效时长区间 + 可出画幅；算不出来不让整个下拉挂掉，退回「区间未知」并记 WARN。 */
    private com.aistareco.aep.dto.EndpointCapabilityDto videoCapability(AiModelInvocationService.ResolvedEndpoint r) {
        if (videoModels == null) return com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate());
        try {
            MaterialVideoModelClient.DurationBounds b =
                    videoModels.effectiveDurationBounds(r.endpoint().getId(), r.endpoint());
            return com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate(), b.minSec(), b.maxSec(),
                    videoModels.videoGeometry(r.endpoint()));
        } catch (RuntimeException e) {
            log.warn("[drama-render] 视频模型时长区间算不出来 endpoint={}: {}", r.endpoint().getName(), e.toString());
            return com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate());
        }
    }

    /** VIDEO 候选只有显式 override + 端点 PER_SECOND 时才按秒；存量默认价继续保持按次。 */
    static long effectiveVideoCreditCost(AiModelEndpoint endpoint, AiAppEndpointCandidate candidate,
                                         int durationSec, long defaultCost) {
        if (candidate == null || candidate.getCreditCostOverride() == null) return defaultCost;
        long rate = Math.max(0L, candidate.getCreditCostOverride());
        if (endpoint != null && endpoint.getBillingMode() == AiModelBillingMode.PER_SECOND) {
            try {
                return Math.multiplyExact(rate, Math.max(1, durationSec));
            } catch (ArithmeticException e) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_PRICE_OVERFLOW", "这条视频的积分算不出来，请把时长改短一点，或联系平台。");
            }
        }
        return rate;
    }

    private static String candidateBillingUnit(AiModelPurpose purpose, AiModelEndpoint endpoint,
                                               AiAppEndpointCandidate candidate) {
        return purpose == AiModelPurpose.VIDEO_GENERATION
                ? AiModelInvocationService.videoBillingUnit(endpoint, candidate) : "per_call";
    }

    // ── C-1：参考生效回报（applied_refs） ─────────────────────────────────────────

    /** 一条参考项的归类：role（ref/first_frame/last_frame…）+ 是否送达模型 + 未送达原因（wire 全小写枚举）。 */
    record AppliedRef(String role, String url, boolean applied, String reason) {}

    /** 一次渲染的参考生效汇总：requested=携带总数、applied=送达数、items=逐项归类。 */
    record AppliedRefs(java.util.List<AppliedRef> items) {
        int requested() { return items.size(); }
        int appliedCount() { return (int) items.stream().filter(AppliedRef::applied).count(); }
        java.util.List<String> validUrls() {
            return items.stream().filter(AppliedRef::applied).map(AppliedRef::url).toList();
        }
    }

    /** 首帧出图的参考图集：C-1 前端仍传无槽位数组，统一标 role="ref"；本地/相对 URL 标 local_unfetchable。 */
    static AppliedRefs computeFrameAppliedRefs(JsonNode refImages) {
        java.util.List<AppliedRef> items = new java.util.ArrayList<>();
        if (refImages != null && refImages.isArray()) {
            for (JsonNode n : refImages) {
                String u = n == null ? "" : n.asText("").trim();
                if (u.isEmpty()) continue;
                boolean ok = isFetchableImageRef(u);
                items.add(new AppliedRef("ref", u, ok, ok ? null : "local_unfetchable"));
            }
        }
        return new AppliedRefs(items);
    }

    /**
     * 端点是否支持首+尾帧关键帧（静态关键字判定，复用 MaterialVideoModelClient 的协议识别口径）：
     * agnes 仅首帧（无尾帧）；seedance / generic（best-effort 带 end_image，下游不支持则忽略）视为支持。
     */
    static boolean supportsFirstLastFrame(AiModelEndpoint ep) {
        if (ep == null) return false;
        String blob = ((ep.getName() == null ? "" : ep.getName()) + " "
                + (ep.getBaseUrl() == null ? "" : ep.getBaseUrl()) + " "
                + (ep.getModel() == null ? "" : ep.getModel())).toLowerCase();
        return !blob.contains("agnes");
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    private static String ratioToSize(String ratio) {
        return switch (ratio) {
            case "16:9" -> "1280x720";
            case "1:1" -> "1024x1024";
            case "4:3" -> "1024x768";
            case "3:4" -> "768x1024";
            default -> "720x1280"; // 9:16 竖屏
        };
    }

    private static String rstrip(String s) {
        if (s == null) return "";
        String t = s.trim();
        return t.endsWith("/") ? t.substring(0, t.length() - 1) : t;
    }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n == null ? null : n.get(f);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    /** 参考图 URL 是否外部图像模型可抓取：绝对 http(s) 且非本机地址。 */
    private static boolean isFetchableImageRef(String u) {
        String s = u == null ? "" : u.trim().toLowerCase();
        if (!(s.startsWith("http://") || s.startsWith("https://"))) return false;
        return !(s.contains("://localhost") || s.contains("://127.0.0.1") || s.contains("://0.0.0.0")
                || s.startsWith("http://192.168.") || s.startsWith("http://10.") || s.startsWith("http://172."));
    }
}
