package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 带货视频生成 —— 视频大模型的「提交 + 轮询」HTTP 客户端（单一可替换点）。
 *
 * 端点（baseUrl / apiKey / model）取自后台「AI 模型与 Key」配置：把用途 VIDEO_GENERATION 在
 * 「AI 应用绑定」绑到一个模型接入端点（v0.41 起统一走 {@link AiModelInvocationService#resolveEndpoint}）；
 * 「怎么提交 / 怎么轮询」的协议细节取自 aep.material.video.*（见 MaterialVideoProperties）。
 *
 * 默认对齐「异步任务式」约定（提交返回 task_id，轮询拿 status + 成片 URL），与
 * 智谱 CogVideoX 一致：POST {baseUrl}/videos/generations → GET {baseUrl}/async-result/{id}。
 * 响应解析对常见字段做了多形态兜底，换厂商时一般只需改 baseUrl + submit/poll 子路径；
 * 若厂商 wire 差异大，替换本文件的 submit()/poll() 解析即可，不影响任务调度 / 积分 / 前端。
 *
 * 不静默兜底：未绑定端点 / 无 apiKey → 抛 VIDEO_NOT_CONFIGURED（503，明确提示去哪配）。
 */
@Service
public class MaterialVideoModelClient {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoModelClient.class);
    private static final ObjectMapper OM = new ObjectMapper();
    private static final String PROTOCOL_GENERIC = "generic";
    private static final String PROTOCOL_AGNES = "agnes";
    private static final String PROTOCOL_SEEDANCE = "seedance";
    private static final String PROTOCOL_JUSUAN_MEDIA = "jusuan-media";
    private static final int AGNES_FRAME_RATE = 24;

    private final AiModelInvocationService invocation;
    private final MaterialVideoProperties props;
    private final AiModelUsageService usage;
    private final UpstreamModelHttp upstreamHttp;
    private final com.aistareco.aep.service.storage.FileStorageService storage;
    private final HttpClient http;

    public MaterialVideoModelClient(AiModelInvocationService invocation,
                                    MaterialVideoProperties props,
                                    AiModelUsageService usage,
                                    UpstreamModelHttp upstreamHttp,
                                    com.aistareco.aep.service.storage.FileStorageService storage) {
        this.invocation = invocation;
        this.props = props;
        this.usage = usage;
        this.upstreamHttp = upstreamHttp;
        this.storage = storage;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    /** 是否已配置可用的视频生成端点（用途 VIDEO_GENERATION 已绑定 + 有 apiKey）。 */
    public boolean isConfigured() {
        AiModelEndpoint p = pickEndpoint(null);
        return p != null && decryptKey(p) != null;
    }

    /** 失败快：未绑定端点 / 无 apiKey 时抛 VIDEO_NOT_CONFIGURED（带明确提示）。 */
    public void ensureConfigured() {
        requireKey(requireEndpoint(null));
    }

    /** 端点是否具备提交条件（有 baseUrl + 可解密的 apiKey）——models 列表据此过滤不可提交项。 */
    public boolean isEndpointReady(AiModelEndpoint endpoint) {
        return endpoint != null
                && endpoint.getBaseUrl() != null && !endpoint.getBaseUrl().isBlank()
                && decryptKey(endpoint) != null;
    }

    /**
     * 这个端点是否走聚算媒体协议（MiniMax H3 的四种原生模式只有这条协议能表达）。
     * 视频生成区的模型列表据此过滤；判定与提交时用的是同一个 {@link #protocolFor}。
     */
    public boolean isJusuanMedia(AiModelEndpoint endpoint) {
        return endpoint != null && PROTOCOL_JUSUAN_MEDIA.equals(protocolFor(endpoint, modelOf(endpoint)));
    }

    /** 端点实际调用的模型名：端点上配了就用它，没配回落 aep.material.video.default-model。 */
    private String modelOf(AiModelEndpoint endpoint) {
        return endpoint.getModel() != null && !endpoint.getModel().isBlank()
                ? endpoint.getModel() : props.getDefaultModel();
    }

    /**
     * 提交/冻结积分前的时长策略收口（同一归一值供校验、报价、落库、供应商请求四处使用）：
     *   1) duration 必填且 &gt;0（400 VIDEO_DURATION_REQUIRED）——不同协议默认时长各异，
     *      放任 0 会让校验、PER_SECOND 报价（max(1,·)）、任务落库与实际生成用上不同真值；
     *   2) 有效区间 = 协议硬边界 ∩ candidate.maxDurationSec，越界 → 400 VIDEO_DURATION_UNSUPPORTED
     *      （带货口径文案：当前值 / 允许区间 / 怎么改）。未知边界 = null，绝不臆造下限。
     * H3 的 requireJusuanDuration 仍保留在 submit 路径做最后防线。
     */
    public void validateRequest(String endpointId, int durationSec) {
        AiModelEndpoint endpoint = requireEndpoint(endpointId);
        requireKey(endpoint);
        if (durationSec <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_DURATION_REQUIRED",
                    "请提供视频时长（整数秒）后再提交生成。");
        }
        DurationBounds bounds = effectiveDurationBounds(endpointId, endpoint);
        if ((bounds.minSec() != null && durationSec < bounds.minSec())
                || (bounds.maxSec() != null && durationSec > bounds.maxSec())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_DURATION_UNSUPPORTED",
                    durationRangeMessage(endpoint, bounds, durationSec));
        }
    }

    /** 协议硬时长边界（秒）；未知边界 = null（不臆造）。agnes 上限 = 441 帧 / 24fps ≈ 18 秒。 */
    public DurationBounds protocolDurationBounds(AiModelEndpoint endpoint) {
        String protocol = protocolFor(endpoint, modelOf(endpoint));
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            return new DurationBounds(JusuanH3Contract.MIN_SECONDS, JusuanH3Contract.MAX_SECONDS);
        }
        if (PROTOCOL_AGNES.equals(protocol)) return new DurationBounds(null, 441 / AGNES_FRAME_RATE);
        return new DurationBounds(null, null);
    }

    /** 某端点的有效时长区间 = 协议硬边界 ∩ candidate.maxDurationSec（capability 未配置 → 只剩协议边界）。 */
    public DurationBounds effectiveDurationBounds(String endpointId, AiModelEndpoint endpoint) {
        DurationBounds protocol = protocolDurationBounds(endpoint);
        AiModelInvocationService.ResolvedEndpoint resolved =
                invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, endpointId).orElse(null);
        return intersect(protocol, resolved == null ? null : resolved.candidate());
    }

    /** 协议边界 ∩ candidate 配置：上限取两者较小值；下限当前只有协议提供（candidate 无 minDurationSec 列）。 */
    public static DurationBounds intersect(DurationBounds protocol, com.aistareco.aep.model.AiAppEndpointCandidate candidate) {
        Integer max = protocol.maxSec();
        Integer configured = candidate == null ? null : candidate.getMaxDurationSec();
        if (configured != null && configured > 0 && (max == null || configured < max)) max = configured;
        return new DurationBounds(protocol.minSec(), max);
    }

    static String durationRangeMessage(AiModelEndpoint endpoint, DurationBounds bounds, int durationSec) {
        String name = endpoint.getName() != null && !endpoint.getName().isBlank() ? endpoint.getName() : "当前视频模型";
        String range;
        if (bounds.minSec() != null && bounds.maxSec() != null) {
            range = "单条时长需在 " + bounds.minSec() + " 至 " + bounds.maxSec() + " 秒之间";
        } else if (bounds.maxSec() != null) {
            range = "单条时长最长 " + bounds.maxSec() + " 秒";
        } else {
            range = "单条时长至少 " + bounds.minSec() + " 秒";
        }
        return name + " " + range + "，本次为 " + durationSec + " 秒。请在脚本工坊压缩口播与分镜时长，或换用其他生成模型。";
    }

    /** 时长边界（秒）；null = 该侧无已知硬边界。 */
    public record DurationBounds(Integer minSec, Integer maxSec) {}

    /**
     * 这个端点**真正能出**的画幅（协议决定，不是后台能填的）。
     *
     * <p>为什么需要：画布的参数面板照搬了上游的通用选项 —— 清晰度 480p/720p/1080p、
     * 比例 1:1 / 3:4 / 4:3 / 16:9 / 9:16 / 21:9。而聚算媒体协议里**根本没有宽高字段**：
     * 只有 {@code resolutionTier}（H3 固定 768p）和 {@code orientation}（只有横 / 竖两种），
     * 出多少像素由厂商的 preset 定。于是用户选「720p · 3:4」，我们送出去的是
     * 「768p · portrait」，回来的是 768×1376（≈9:16）—— 选的和拿到的对不上，
     * 而界面上没有任何地方说过这件事（v0.184 用户实测报的）。
     *
     * <p>返回 null = 该协议没有这层限制（agnes / generic 我们自己按比例算宽高，
     * 整张比例表都成立），前端保留完整选项。
     */
    public VideoGeometry videoGeometry(AiModelEndpoint endpoint) {
        if (!isJusuanMedia(endpoint)) return null;
        // 协议只给横 / 竖两档；标成最接近的通用比例，别报一个我们并不能保证的精确值。
        return new VideoGeometry(java.util.List.of("768"), java.util.List.of("16:9", "9:16"));
    }

    /**
     * 端点能出的画幅。{@code resolutions} 是清晰度短边（"768"），{@code ratios} 是比例。
     * 两者都非空即表示「只有这些可选」；字段为 null 表示该维度不受限。
     */
    public record VideoGeometry(java.util.List<String> resolutions, java.util.List<String> ratios) {}

    /**
     * 返回候选端点显式配置的视频积分价；未配置 override 时返回 {@code null}，由业务线回落自身默认价。
     * PER_SECOND 端点按请求秒数展开，PER_CALL/旧端点仍按次，避免把存量候选价格语义整体改写。
     */
    public Long resolveCreditCostOverride(String endpointId, int durationSec) {
        AiModelInvocationService.ResolvedEndpoint resolved =
                invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, endpointId).orElse(null);
        if (resolved == null || resolved.candidate() == null
                || resolved.candidate().getCreditCostOverride() == null) {
            return null;
        }
        long rate = Math.max(0L, resolved.candidate().getCreditCostOverride());
        if (resolved.endpoint().getBillingMode() != AiModelBillingMode.PER_SECOND) return rate;
        try {
            return Math.multiplyExact(rate, Math.max(1, durationSec));
        } catch (ArithmeticException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_PRICE_OVERFLOW", "视频积分报价超出可用范围");
        }
    }

    /** 重新接管一个已经由上游受理的异步任务；只构造轮询上下文，绝不再次提交生成。 */
    public SubmitResult resumeExistingTask(String taskId, String endpointId, String providerUsed, String modelUsed) {
        AiModelEndpoint endpoint = requireEndpoint(endpointId);
        String model = modelUsed != null && !modelUsed.isBlank()
                ? modelUsed
                : (endpoint.getModel() != null && !endpoint.getModel().isBlank()
                ? endpoint.getModel() : props.getDefaultModel());
        return new SubmitResult(taskId, null,
                providerUsed != null && !providerUsed.isBlank() ? providerUsed : endpoint.getName(),
                model, protocolFor(endpoint, model), endpoint.getId());
    }

    /**
     * 提交一个生成任务，返回外部 task_id + 实际用到的端点 / model。appCode 用于用量归属（drama / celebrity）。
     * D-11：endpointId 非空 → 用指定候选端点（白名单，未命中抛 ENDPOINT_NOT_ALLOWED）；为空 → 默认端点（旧路径不变）。
     * 返回的 {@link SubmitResult} 带上 endpointId，使后续 poll 落到同一端点（同 baseUrl/apiKey）。
     */
    /**
     * 提交生成任务。{@code spec} 是这次的输入规格（worker 用 {@link VideoGenSpec#fromVariantConfigJson} 解析）：
     * 老路径（画布 / 脚本视频 / 短剧）至多带一个首帧 key；视频生成区带完整的 H3 原生规格。
     * 什么输入都没有就传 {@link VideoGenSpec#EMPTY}。
     *
     * <p>刻意**不留**旧的「只带首帧 key」的重载：同一件事两种调法，迟早有人用了少一个参数的那个，
     * 参考图就这么悄悄丢了（今天已经在别处栽过两次，§8.0.1 ④）。
     */
    public SubmitResult submit(String prompt, int durationSec, String aspectRatio, String ownerUserId,
                               String appCode, String endpointId, VideoGenSpec spec) {
        VideoGenSpec genSpec = spec == null ? VideoGenSpec.EMPTY : spec;
        AiModelEndpoint p = requireEndpoint(endpointId);
        String apiKey = requireKey(p);
        String model = modelOf(p);
        String protocol = protocolFor(p, model);
        // 先判能不能表达，再动素材：组不出来的包不该先把素材传给厂商。
        requireProtocolSupports(protocol, genSpec, aspectRatio);

        UpstreamInputs inputs = resolveUpstreamInputs(p, apiKey, model, protocol, genSpec);
        Map<String, Object> body = buildSubmitBody(protocol, model, prompt, durationSec, aspectRatio, genSpec, inputs);

        URI uri = URI.create(joinUrl(p.getBaseUrl(), submitPathFor(protocol)));
        long startNanos = System.nanoTime();
        String requestId = "vid-" + UUID.randomUUID().toString().substring(0, 16);
        log.info("[material-video] submit start endpoint={} model={} protocol={} path={} durationSec={} aspectRatio={} generationMode={} tier={} refs={} promptLength={}",
                p.getName(), model, protocol, uri.getPath(), durationSec, aspectRatio, genSpec.generationMode(),
                genSpec.resolutionTier(), genSpec.references().size(), prompt == null ? 0 : prompt.length());

        HttpRequest req;
        String bodyJson;
        try {
            bodyJson = OM.writeValueAsString(body);
            req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();
        } catch (Exception e) {
            recordVideoUsage(p, model, durationSec, false, ownerUserId, appCode, requestId, null, elapsedMs(startNanos),
                    e.getClass().getSimpleName(), e.getMessage());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成失败，请稍后重试", "endpoint=" + p.getName() + " err=" + e);
        }
        // v0.85：发送 + 原始日志 + 非 2xx WARN + 失败用量统一走共享原语（带显式归属：drama / celebrity）。
        ModelCallCtx ctx = ModelCallCtx.builder(AiModelPurpose.VIDEO_GENERATION)
                .endpoint(p.getId(), p.getName())
                .model(model)
                .requestId(requestId)
                .ownerUserId(ownerUserId)
                .appCode(appCode)
                // 不设这个字段的话 [upstream-io] 那行永远打成 `body=` —— 出片参数（generationMode /
                // 参考图 assetId / 时长比例）一个都看不到，排「参数到底发出去没有」全靠猜（v0.184 踩过）。
                .requestBodyJson(auditBody(bodyJson))
                .client(http)
                .build();
        HttpResponse<String> resp;
        try {
            resp = upstreamHttp.sendJson(req, ctx);
        } catch (UpstreamCallException ex) {
            throw new SubmissionUnknown("endpoint=" + p.getName() + " err=" + ex.getCause());
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            // 上游的原话必须留在日志里（§8.0.1 ①）：internalDetail 只在 HTTP 请求路径上落 ErrorLog，
            // 而这里跑在 @Async worker 里，不写这一行就等于什么都没记。
            log.warn("[material-video] submit rejected endpoint={} model={} protocol={} status={} durationMs={} body={}",
                    p.getName(), model, protocol, resp.statusCode(), elapsedMs(startNanos), snippet(resp.body()));
            // 4xx 是「我们请求哪儿不对」，厂商原话直出给用户；5xx 是厂商自己的问题，只给状态码。
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    submitFailureMessage(resp.statusCode(), resp.body()),
                    "endpoint=" + p.getName() + " model=" + model + " status=" + resp.statusCode()
                            + " body=" + snippet(resp.body()));
        }
        try {
            JsonNode root = OM.readTree(resp.body());
            String taskId = firstText(root, "id", "job_id", "task_id", "request_id", "jobId", "taskId");
            String videoId = firstText(root, "video_id", "videoId");
            if (taskId == null) {
                JsonNode data = root.get("data");
                if (data != null) taskId = firstText(data, "id", "job_id", "task_id", "request_id", "jobId", "taskId");
            }
            if (videoId == null) {
                JsonNode data = root.get("data");
                if (data != null) videoId = firstText(data, "video_id", "videoId");
            }
            if ((taskId == null || taskId.isBlank()) && (videoId == null || videoId.isBlank())) {
                log.warn("[material-video] submit missing-task-id endpoint={} model={} durationMs={} body={}",
                        p.getName(), model, elapsedMs(startNanos), snippet(resp.body()));
                upstreamHttp.recordBadOutput(ctx, resp.body(), "VIDEO_SUBMIT_FAILED", elapsedMs(startNanos));
                throw new SubmissionUnknown("missing task/video id; endpoint=" + p.getName() + " body=" + snippet(resp.body()));
            }
            log.info("[material-video] submit ok endpoint={} model={} protocol={} taskId={} videoId={} durationMs={}",
                    p.getName(), model, protocol, taskId, videoId, elapsedMs(startNanos));
            recordVideoUsage(p, model, durationSec, true, ownerUserId, appCode, requestId,
                    (taskId != null && !taskId.isBlank()) ? taskId : videoId,
                    elapsedMs(startNanos), null, null);
            // 无论调用方是否显式选端点，都冻结实际 endpoint id；轮询/受保护资产读取不可随默认绑定漂移。
            return new SubmitResult(taskId, videoId, p.getName(), model, protocol, p.getId());
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            // 2xx 但响应体无法解析：记原始响应后转业务错误。
            log.warn("[material-video] submit bad-output endpoint={} model={} durationMs={} err={}",
                    p.getName(), model, elapsedMs(startNanos), e.toString());
            upstreamHttp.recordBadOutput(ctx, resp.body(), "VIDEO_SUBMIT_FAILED", elapsedMs(startNanos));
            throw new SubmissionUnknown("endpoint=" + p.getName() + " err=" + e);
        }
    }

    /** A create request may be accepted without a readable reply. It must keep its capacity reservation. */
    public static class SubmissionUnknown extends BusinessException {
        public SubmissionUnknown(String detail) {
            super(HttpStatus.BAD_GATEWAY,"VIDEO_SUBMISSION_UNKNOWN","视频受理结果尚未确认，请联系运营核对，请勿重新生成",null,detail);
        }
    }

    private void recordVideoUsage(AiModelEndpoint endpoint,
                                  String model,
                                  int durationSec,
                                  boolean success,
                                  String ownerUserId,
                                  String appCode,
                                  String requestId,
                                  String upstreamId,
                                  long latencyMs,
                                  String errorCode,
                                  String errorMessage) {
        try {
            long seconds = success ? Math.max(1, durationSec > 0 ? durationSec : props.getDefaultDurationSec()) : 0L;
            usage.recordMeteredObservedWithAttribution(
                    endpoint.getId(),
                    endpoint.getName(),
                    model,
                    AiModelPurpose.VIDEO_GENERATION.name(),
                    0L,
                    0L,
                    0L,
                    AiModelBillingMode.PER_SECOND,
                    success ? 1L : 0L,
                    seconds,
                    success,
                    ownerUserId,
                    null,
                    appCode,
                    requestId,
                    upstreamId,
                    latencyMs,
                    errorCode,
                    errorMessage,
                    null,
                    null,
                    null);
        } catch (Exception ignored) {
            // 用量观测旁路，不影响视频任务主流程。
        }
    }

    /** 轮询一个任务的状态。失败抛 BusinessException（含 HTTP 详情）。 */
    public PollResult poll(String taskId) {
        return poll(new SubmitResult(taskId, null, null, null, PROTOCOL_GENERIC, null));
    }

    /** 轮询一个任务的状态。失败抛 BusinessException（含 HTTP 详情）。
     *  D-11：用 submit 时选定的同一端点轮询（submit.endpointId()），确保 baseUrl/apiKey 一致。 */
    public PollResult poll(SubmitResult submit) {
        AiModelEndpoint p = requireEndpoint(submit.endpointId());
        String apiKey = requireKey(p);
        String idForLog = submit.externalId();
        URI uri = pollUri(p, submit);
        long startNanos = System.nanoTime();
        // 轮询不落失败用量（沿用历史行为，避免每隔几秒的瞬时 poll 失败刷爆用量表）；原始日志仍统一走原语。
        ModelCallCtx ctx = ModelCallCtx.builder(AiModelPurpose.VIDEO_GENERATION)
                .endpoint(p.getId(), p.getName())
                .model(submit.modelUsed())
                .requestId("vid-poll-" + UUID.randomUUID().toString().substring(0, 12))
                .client(http)
                .recordFailureUsage(false)
                .build();
        HttpResponse<String> resp;
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            resp = upstreamHttp.sendJson(req, ctx);
        } catch (UpstreamCallException ex) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频生成失败，请稍后重试",
                    "poll; endpoint=" + p.getName() + " taskId=" + idForLog + " err=" + ex.getCause());
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频生成失败，请稍后重试",
                    "poll; endpoint=" + p.getName() + " taskId=" + idForLog + " status=" + resp.statusCode()
                            + " body=" + snippet(resp.body()));
        }
        try {
            JsonNode root = OM.readTree(resp.body());
            String rawStatus = firstText(root, "task_status", "status", "state");
            if (rawStatus == null) {
                JsonNode data = root.get("data");
                if (data != null) rawStatus = firstText(data, "task_status", "status", "state");
            }
            String status = normalizeStatus(rawStatus);
            String videoUrl = extractVideoUrl(root);
            String thumb = extractThumb(root);
            String lastFrameUrl = extractLastFrameUrl(root);
            String outputAssetId = extractOutputAssetId(root);
            Integer progressPct = extractProgressPct(root);
            String failReason = "failed".equals(status) ? extractFailReason(root) : null;
            if ("failed".equals(status)) {
                // 上游判失败：记原始响应体，方便排查（agnes 等可能不给结构化原因字段）。
                log.warn("[material-video] poll FAILED endpoint={} protocol={} taskId={} rawStatus={} progress={} failReason={} durationMs={} body={}",
                        p.getName(), submit.protocol(), idForLog, rawStatus, progressPct, failReason,
                        elapsedMs(startNanos), snippet(resp.body()));
            } else if (!"processing".equals(status)) {
                log.info("[material-video] poll terminal endpoint={} protocol={} taskId={} status={} rawStatus={} progress={} hasVideo={} durationMs={}",
                        p.getName(), submit.protocol(), idForLog, status, rawStatus, progressPct,
                        videoUrl != null && !videoUrl.isBlank(), elapsedMs(startNanos));
            }
            return new PollResult(status, videoUrl, thumb, rawStatus, progressPct, failReason, lastFrameUrl,
                    outputAssetId);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.warn("[material-video] poll exception endpoint={} protocol={} taskId={} durationMs={} err={}",
                    p.getName(), submit.protocol(), idForLog, elapsedMs(startNanos), e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频生成失败，请稍后重试",
                    "poll; endpoint=" + p.getName() + " taskId=" + idForLog + " err=" + e);
        }
    }

    // ── 端点选取（v0.41：用途 VIDEO_GENERATION → ai_app_binding → 端点） ─────────────

    /** D-11：endpointId 为空 → 默认端点（旧行为不变）；指定 → 候选端点白名单，未命中抛 ENDPOINT_NOT_ALLOWED。 */
    private AiModelEndpoint pickEndpoint(String endpointId) {
        if (endpointId != null && !endpointId.isBlank()) {
            return invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, endpointId)
                    .map(AiModelInvocationService.ResolvedEndpoint::endpoint)
                    .filter(p -> p.getBaseUrl() != null && !p.getBaseUrl().isBlank())
                    .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "ENDPOINT_NOT_ALLOWED",
                            "所选出片模型不可用或未在「视频生成」候选池内，请刷新后重选。"));
        }
        return invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)
                .filter(p -> p.getBaseUrl() != null && !p.getBaseUrl().isBlank())
                .orElse(null);
    }

    private AiModelEndpoint requireEndpoint(String endpointId) {
        AiModelEndpoint p = pickEndpoint(endpointId);
        if (p == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                    "未为「视频生成」绑定 AI 模型端点。请到 管理后台 → 平台与配置 → AI 模型与 Key →"
                            + "「AI 应用绑定」把「视频生成」绑到一个端点（端点需含 baseUrl 与有效 API Key）。");
        }
        return p;
    }

    private String decryptKey(AiModelEndpoint p) {
        try {
            String k = AepCryptoUtil.decrypt(p.getUpstreamApiKeyEncrypted());
            return (k == null || k.isBlank()) ? null : k;
        } catch (Exception e) {
            return null;
        }
    }

    private String requireKey(AiModelEndpoint p) {
        String k = decryptKey(p);
        if (k == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                    "视频生成端点「" + p.getName() + "」未配置有效 API Key（请到 AI 模型与 Key 页补全）。");
        }
        return k;
    }

    // ── 协议适配 ──────────────────────────────────────────────────────────────

    /**
     * 一次提交里交给厂商的输入，已经换成厂商认得的形式：
     * 聚算是先上传拿到的 assetId；seedance / agnes / 通用协议是一个厂商自己去抓的首帧 URL。
     * 顺序与 {@link VideoGenSpec#references()} 一致。
     */
    record UpstreamInputs(String firstFrameUrl, String firstFrameAssetId, String lastFrameAssetId,
                          List<ReferenceAsset> references) {
        static final UpstreamInputs NONE = new UpstreamInputs(null, null, null, List.of());

        UpstreamInputs {
            references = references == null ? List.of() : List.copyOf(references);
        }

        static UpstreamInputs firstFrameUrl(String url) {
            return new UpstreamInputs(url, null, null, List.of());
        }

        static UpstreamInputs firstFrameAsset(String assetId) {
            return new UpstreamInputs(null, assetId, null, List.of());
        }
    }

    /** 全能参考的一项素材，已上传到聚算。 */
    record ReferenceAsset(String mediaType, String assetId) {}

    /**
     * 这个协议能不能表达这份规格。表达不了就在动任何素材之前 400，**不静默丢参数**（§8.0）：
     * <ul>
     *   <li>非聚算协议收到原生参数（模式 / 清晰度 / 种子 / 尾帧 / 参考素材）→ {@code VIDEO_MODE_UNSUPPORTED}；
     *       只带首帧 key 的老路径照常（首帧换成 URL 交给厂商，见 {@link #resolveUpstreamInputs}）。</li>
     *   <li>聚算收到原生参数但缺清晰度 → 组不出完整的 H3 请求，同样拒绝，不退回老路径的 768p 包。</li>
     *   <li>完整的原生规格：模式 / 清晰度 / 比例 / 该模式必需的素材再核一遍 —— 服务端已在冻结积分前校验过，
     *       这里是最后一道，防止组出一个厂商必拒的包。</li>
     * </ul>
     */
    static void requireProtocolSupports(String protocol, VideoGenSpec spec, String aspectRatio) {
        if (!PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            if (spec.hasNativeOptions()) {
                throw BusinessException.badRequest("VIDEO_MODE_UNSUPPORTED",
                        "所选视频模型不支持指定生成模式、清晰度、尾帧或参考素材，请换一个视频模型");
            }
            return;
        }
        if (!spec.isExplicit()) {
            if (spec.hasNativeOptions()) {
                throw BusinessException.badRequest("VIDEO_MODE_UNSUPPORTED", "视频参数不完整，缺少清晰度，无法提交");
            }
            return;
        }
        if (!JusuanH3Contract.isMode(spec.generationMode())) {
            throw BusinessException.badRequest("VIDEO_STUDIO_MODE_INVALID", "生成模式不在支持范围内");
        }
        if (JusuanH3Contract.canvas(spec.resolutionTier(), aspectRatio) == null) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID", "清晰度或画面比例不在支持范围内");
        }
        switch (spec.generationMode()) {
            case JusuanH3Contract.MODE_I2V -> requireInput(spec.firstFrameKey() != null, "首帧生视频缺少首帧图");
            case JusuanH3Contract.MODE_FIRST_LAST_FRAME -> {
                requireInput(spec.firstFrameKey() != null, "首尾帧生视频缺少首帧图");
                requireInput(spec.lastFrameKey() != null, "首尾帧生视频缺少尾帧图");
            }
            case JusuanH3Contract.MODE_UNIVERSAL_REFERENCE ->
                    requireInput(!spec.references().isEmpty(), "全能参考至少要一个参考素材");
            default -> { /* t2v：不需要素材 */ }
        }
    }

    private static void requireInput(boolean ok, String message) {
        if (!ok) throw BusinessException.badRequest("VIDEO_STUDIO_INPUT_INVALID", message);
    }

    /**
     * 把规格里的素材 key 换成厂商认得的形式。
     *
     * <p>聚算：图 / 视频 / 音频都不给 URL，得先传上去换 assetId（v0.183 起首帧、v0.199 起全部）。
     * 之前这里一律发 generationMode=t2v、图一张都没送 —— 用户接了参考图，出来的片跟参考图毫无关系。
     *
     * <p>seedance / agnes / 通用协议：首帧给一个厂商自己去抓的 URL（{@link com.aistareco.aep.service.storage.FileStorageService#upstreamFetchUrl}）。
     * 画布能选这些模型以后，只认 prompt 里的首帧标记就等于把用户连进来的参考图悄悄丢掉（§8.0）。
     */
    private UpstreamInputs resolveUpstreamInputs(AiModelEndpoint p, String apiKey, String model,
                                                 String protocol, VideoGenSpec spec) {
        // 「首帧走上传换 assetId 还是给 URL」只在 usesUploadedFirstFrame 一处判定（2026-09-30 热修收口，§8.0.1 ④）
        if (!usesUploadedFirstFrame(protocol)) {
            return spec.firstFrameKey() == null ? UpstreamInputs.NONE
                    : UpstreamInputs.firstFrameUrl(PROTOCOL_AGNES.equals(protocol)
                            ? agnesFirstFrameInput(spec.firstFrameKey()) : requireFetchableUrl(spec.firstFrameKey()));
        }
        if (!spec.isExplicit()) {
            return spec.firstFrameKey() == null ? UpstreamInputs.NONE
                    : UpstreamInputs.firstFrameAsset(uploadInputAsset(p, apiKey, model, spec.firstFrameKey(),
                            JusuanH3Contract.MEDIA_IMAGE, JusuanH3Contract.FRAME_IMAGE_MAX_BYTES, "参考图"));
        }
        String mode = spec.generationMode();
        String first = null;
        String last = null;
        if (JusuanH3Contract.MODE_I2V.equals(mode) || JusuanH3Contract.MODE_FIRST_LAST_FRAME.equals(mode)) {
            first = uploadInputAsset(p, apiKey, model, spec.firstFrameKey(),
                    JusuanH3Contract.MEDIA_IMAGE, JusuanH3Contract.FRAME_IMAGE_MAX_BYTES, "首帧图");
        }
        if (JusuanH3Contract.MODE_FIRST_LAST_FRAME.equals(mode)) {
            last = uploadInputAsset(p, apiKey, model, spec.lastFrameKey(),
                    JusuanH3Contract.MEDIA_IMAGE, JusuanH3Contract.FRAME_IMAGE_MAX_BYTES, "尾帧图");
        }
        List<ReferenceAsset> refs = new ArrayList<>();
        if (JusuanH3Contract.MODE_UNIVERSAL_REFERENCE.equals(mode)) {
            List<String> labels = VideoGenSpec.referenceLabels(spec.references());
            for (int i = 0; i < spec.references().size(); i++) {
                VideoGenSpec.Reference r = spec.references().get(i);
                if (!JusuanH3Contract.isMediaType(r.mediaType())) {
                    throw BusinessException.badRequest("VIDEO_STUDIO_INPUT_INVALID", "参考素材的类型只能是图片、视频或音频");
                }
                String assetId = uploadInputAsset(p, apiKey, model, r.key(), r.mediaType(),
                        JusuanH3Contract.referenceMaxBytes(r.mediaType()), labels.get(i));
                refs.add(new ReferenceAsset(r.mediaType(), assetId));
            }
        }
        return new UpstreamInputs(null, first, last, refs);
    }

    /** 首帧交给厂商去抓的地址；拿到的不是绝对 http(s) 地址（无 CDN 的本机路径）就报错，不假装传了图。 */
    private String requireFetchableUrl(String key) {
        String url = storage == null ? null : storage.upstreamFetchUrl(key);
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            log.warn("[material-video] 首帧没有厂商能访问的地址 key={} url={}", key, url);
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UNREADABLE",
                    "参考图没有视频模型能访问的地址，无法生成视频", "key=" + key + " url=" + url);
        }
        return url;
    }

    /** Local development has no public CDN. Agnes' image input can carry the owned bytes;
     * public deployments still use the existing signed fetch URL. Never drop a selected image. */
    private String agnesFirstFrameInput(String key) {
        String url = storage == null ? null : storage.upstreamFetchUrl(key);
        if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
            String host = URI.create(url).getHost();
            if (host != null && !List.of("localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]").contains(host)) return url;
        }
        String input = storage == null ? null : new com.aistareco.aep.dap.service.DapImageInput(storage).of(key);
        if (input == null || !input.startsWith("data:image/"))
            throw BusinessException.badRequest("VIDEO_REF_UNREADABLE", "参考图无法读取，无法生成视频");
        return input;
    }

    /** Keep parameters in audit records while excluding uploaded image bytes. */
    static String auditBody(String json) {
        try {
            JsonNode body = OM.readTree(json);
            redactInlineImages(body);
            return OM.writeValueAsString(body);
        } catch (IOException e) { return "[unreadable request body]"; }
    }
    private static void redactInlineImages(JsonNode node) {
        if (node.isObject()) {
            var fields = node.fields();
            while(fields.hasNext()) {
                var field = fields.next();
                JsonNode value = field.getValue();
                if(value.isTextual() && value.asText().startsWith("data:image/"))
                    ((com.fasterxml.jackson.databind.node.ObjectNode)node).put(field.getKey(), "[inline image, " + value.asText().length() + " characters]");
                else redactInlineImages(value);
            }
        } else if(node.isArray()) {
            for(int i=0;i<node.size();i++) {
                JsonNode value=node.get(i);
                if(value.isTextual() && value.asText().startsWith("data:image/"))
                    ((com.fasterxml.jackson.databind.node.ArrayNode)node).set(i,OM.getNodeFactory().textNode("[inline image, " + value.asText().length() + " characters]"));
                else redactInlineImages(value);
            }
        }
    }

    Map<String, Object> buildSubmitBody(String protocol, String model, String prompt, int durationSec,
                                        String aspectRatio, VideoGenSpec spec, UpstreamInputs inputs) {
        VideoGenSpec genSpec = spec == null ? VideoGenSpec.EMPTY : spec;
        UpstreamInputs in = inputs == null ? UpstreamInputs.NONE : inputs;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);

        // v0.97 P2：seedance（火山方舟）首+尾帧关键帧 i2v —— content 数组承载文本 + 首/尾帧
        // （role=first_frame/last_frame）+ return_last_frame（取回真实末帧供下一镜链式承接）。
        if (PROTOCOL_SEEDANCE.equals(protocol)) {
            com.fasterxml.jackson.databind.node.ArrayNode content = OM.createArrayNode();
            com.fasterxml.jackson.databind.node.ObjectNode t = OM.createObjectNode();
            t.put("type", "text");
            String text = stripFrameUrlHint(prompt);
            t.put("text", text == null ? "" : text);
            content.add(t);
            // 显式首帧（画布连进来的图）优先于 prompt 里的首帧标记（短剧那条路才有标记）。
            String first = in.firstFrameUrl() != null ? in.firstFrameUrl() : extractFrameUrlHint(prompt);
            if (first != null && !first.isBlank()) content.add(seedanceImage(first, "first_frame"));
            String last = extractLastFrameUrlHint(prompt);
            if (last != null && !last.isBlank()) content.add(seedanceImage(last, "last_frame"));
            body.put("content", content);
            if (aspectRatio != null && !aspectRatio.isBlank()) body.put("ratio", aspectRatio);
            if (durationSec > 0) body.put("duration", durationSec);
            body.put("return_last_frame", true);
            return body;
        }

        // 视频生成区：完整的 H3 原生规格，按 Portal 生成的调用示例组包（字段集与顺序照抄）。
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol) && genSpec.isExplicit()) {
            return jusuanNativeBody(body, prompt, durationSec, aspectRatio, genSpec, in);
        }

        // 首/尾帧 marker 由 vars 拼进 prompt（DramaRenderService），这里抽出来作结构化入参，
        // 并把 marker 文本从 prompt 里剥掉，避免把 URL 原样喂给模型当文字。
        body.put("prompt", nz(stripFrameUrlHint(prompt)));

        if (PROTOCOL_AGNES.equals(protocol)) {
            Dimensions size = dimensionsForAspect(aspectRatio);
            // The current OpenAI-compatible gateway consumes size/seconds; width/height
            // alone were silently replaced by its 832x1088 default in real acceptance.
            body.put("size", size.width() + "x" + size.height());
            body.put("seconds", String.valueOf(durationSec > 0 ? durationSec : props.getDefaultDurationSec()));
            body.put("width", size.width());
            body.put("height", size.height());
            body.put("num_frames", normalizeFrames((durationSec > 0 ? durationSec : props.getDefaultDurationSec()) * AGNES_FRAME_RATE));
            body.put("frame_rate", AGNES_FRAME_RATE);
            String image = in.firstFrameUrl() != null ? in.firstFrameUrl() : extractFrameUrlHint(prompt);
            if (image != null && !image.isBlank()) body.put("image", image);
            return body;
        }

        // 聚算 JusuanHub 统一媒体协议的老路径（画布 / 脚本视频 / 短剧）。
        // 受控规格字段替代 width/height/fps 等原始运行时参数；参考图不能给 URL，必须先
        // POST /v1/assets/input 换 assetId（见 uploadInputAsset）。
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            body.put("prompt", nz(stripFrameUrlHint(prompt)));
            body.put("resolutionTier", JusuanH3Contract.TIER_768P);
            body.put("orientation", orientationForAspect(aspectRatio));
            // 只发 orientation 时竖屏由厂商默认 preset 决定：2026-10-03 线上实测已变成 3:4
            // （effectiveSpec.outputSizeCode=h3-768-3x4，768×1024），画布 / 短剧要的是 9:16。
            // 横竖两档照视频生成区的做法补上 aspectRatio + outputSizeCode；1:1 要发 square，
            // 那个值还没实测过（JusuanH3Contract 头注释），老路径保持原样不跟。
            JusuanH3Contract.Canvas canvas = JusuanH3Contract.canvas(JusuanH3Contract.TIER_768P,
                    aspectRatio == null ? null : aspectRatio.trim());
            if (canvas != null && !"square".equals(JusuanH3Contract.orientation(canvas))) {
                body.put("aspectRatio", canvas.aspectRatio());
                body.put("outputSizeCode", JusuanH3Contract.outputSizeCode(JusuanH3Contract.TIER_768P, canvas.aspectRatio()));
            }
            body.put("seconds", requireJusuanDuration(durationSec));
            // 有首帧就走图生视频；没有才是纯文生视频。generationMode 是 H3 的必填项。
            if (in.firstFrameAssetId() != null && !in.firstFrameAssetId().isBlank()) {
                body.put("generationMode", JusuanH3Contract.MODE_I2V);
                body.put("input_image_asset_id", in.firstFrameAssetId());
            } else {
                body.put("generationMode", JusuanH3Contract.MODE_T2V);
            }
            return body;
        }

        // GENERIC：多数厂商忽略不认识的字段；带上时长/比例，并 best-effort 带首/尾帧（i2v）。
        // 下游不支持首尾帧时字段被忽略、不报错（§8.0：传入不生效 ≠ 静默伪造产物）。
        if (durationSec > 0) body.put("duration", durationSec);
        if (aspectRatio != null && !aspectRatio.isBlank()) {
            body.put("aspect_ratio", aspectRatio);
            body.put("size", aspectRatio);
        }
        String firstFrame = in.firstFrameUrl() != null ? in.firstFrameUrl() : extractFrameUrlHint(prompt);
        if (firstFrame != null && !firstFrame.isBlank()) body.put("image", firstFrame);
        String lastFrame = extractLastFrameUrlHint(prompt);
        if (lastFrame != null && !lastFrame.isBlank()) body.put("end_image", lastFrame);
        return body;
    }

    /**
     * H3 原生请求体。字段集与顺序照抄 Portal「API 接入」生成的示例：
     * {@code model, generationMode, prompt, resolutionTier, orientation, aspectRatio, outputSizeCode, seconds,
     * [seed], [input_image_asset_id], [end_image_asset_id], [referenceInputs]}。
     * 厂商明确不许传的 fps / frames / width / height / steps 一个都不带。
     */
    private static Map<String, Object> jusuanNativeBody(Map<String, Object> body, String prompt, int durationSec,
                                                        String aspectRatio, VideoGenSpec spec, UpstreamInputs in) {
        requireProtocolSupports(PROTOCOL_JUSUAN_MEDIA, spec, aspectRatio);
        JusuanH3Contract.Canvas canvas = JusuanH3Contract.canvas(spec.resolutionTier(), aspectRatio);
        body.put("generationMode", spec.generationMode());
        // 用户原文照发（服务端已去首尾空白），不做首帧标记剥离 —— 那是短剧路径的内部约定。
        body.put("prompt", nz(prompt));
        body.put("resolutionTier", spec.resolutionTier());
        body.put("orientation", JusuanH3Contract.orientation(canvas));
        body.put("aspectRatio", canvas.aspectRatio());
        body.put("outputSizeCode", JusuanH3Contract.outputSizeCode(spec.resolutionTier(), canvas.aspectRatio()));
        body.put("seconds", requireJusuanDuration(durationSec));
        if (spec.seed() != null) body.put("seed", spec.seed());
        switch (spec.generationMode()) {
            case JusuanH3Contract.MODE_I2V ->
                    body.put("input_image_asset_id", requireAsset(in.firstFrameAssetId(), "首帧图"));
            case JusuanH3Contract.MODE_FIRST_LAST_FRAME -> {
                body.put("input_image_asset_id", requireAsset(in.firstFrameAssetId(), "首帧图"));
                body.put("end_image_asset_id", requireAsset(in.lastFrameAssetId(), "尾帧图"));
            }
            case JusuanH3Contract.MODE_UNIVERSAL_REFERENCE -> {
                if (in.references().isEmpty()) requireAsset(null, "参考素材");
                List<Map<String, Object>> refs = new ArrayList<>();
                for (ReferenceAsset r : in.references()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("role", JusuanH3Contract.referenceRole(r.mediaType()));
                    item.put("mediaType", r.mediaType());
                    item.put("assetId", requireAsset(r.assetId(), "参考素材"));
                    refs.add(item);
                }
                body.put("referenceInputs", refs);
            }
            default -> { /* t2v：纯文生视频，不带任何素材字段 */ }
        }
        return body;
    }

    private static String requireAsset(String assetId, String label) {
        if (assetId == null || assetId.isBlank()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_INPUT_INVALID", label + "还没有传给视频模型，无法提交");
        }
        return assetId;
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode seedanceImage(String url, String role) {
        com.fasterxml.jackson.databind.node.ObjectNode item = OM.createObjectNode();
        item.put("type", "image_url");
        com.fasterxml.jackson.databind.node.ObjectNode iu = OM.createObjectNode();
        iu.put("url", url);
        item.set("image_url", iu);
        item.put("role", role);
        return item;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private String submitPathFor(String protocol) {
        if (PROTOCOL_AGNES.equals(protocol) && isDefaultSubmitPath(props.getSubmitPath())) {
            return "/videos";
        }
        if (PROTOCOL_SEEDANCE.equals(protocol) && isDefaultSubmitPath(props.getSubmitPath())) {
            return "/contents/generations/tasks";
        }
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol) && isDefaultSubmitPath(props.getSubmitPath())) {
            return "/media/generations";
        }
        return props.getSubmitPath();
    }

    private URI pollUri(AiModelEndpoint p, SubmitResult submit) {
        if (submit == null || submit.externalId() == null) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频生成失败，请稍后重试", "poll missing task/video id");
        }
        if (submit.isAgnes() && isDefaultPollPath(props.getPollPathTemplate())) {
            if (submit.videoId() != null && !submit.videoId().isBlank()) {
                String query = "video_id=" + encodeQuery(submit.videoId());
                if (submit.modelUsed() != null && !submit.modelUsed().isBlank()) {
                    query += "&model_name=" + encodeQuery(submit.modelUsed());
                }
                return URI.create(apiRoot(p.getBaseUrl()) + "/agnesapi?" + query);
            }
            return URI.create(joinUrl(p.getBaseUrl(), "/videos/" + submit.externalId()));
        }
        if (submit.isSeedance() && isDefaultPollPath(props.getPollPathTemplate())) {
            return URI.create(joinUrl(p.getBaseUrl(), "/contents/generations/tasks/" + submit.externalId()));
        }
        if (submit.isJusuanMedia() && isDefaultPollPath(props.getPollPathTemplate())) {
            return jusuanScopedUri(p.getBaseUrl(), "/jobs/" + submit.externalId(),
                    modelForScopedRequest(p, submit));
        }
        String path = props.getPollPathTemplate().replace("{id}", submit.externalId());
        return URI.create(joinUrl(p.getBaseUrl(), path));
    }

    /**
     * 这个端点收首帧，是不是只认「我方存储 key」（2026-09-30 热修）。
     *
     * <p>聚算媒体协议的图不收 URL：{@link #submit} 只看 {@code firstFrameKey}，按 key 读出字节上传换 assetId，
     * 提示词里的首帧 URL 标记会被 {@code stripFrameUrlHint} 剥掉。业务线（短剧 renderClip）据此决定
     * 要不要往 {@code variant_config.first_frame_key} 写 key —— 不写的话首帧根本到不了模型。
     * 其余协议（seedance / agnes / generic）从提示词标记里取 URL，返回 false。
     *
     * <p>端点解析与 {@link #submit} 同一条（{@code requireEndpoint}），判定与 submit 同一处（{@link #usesUploadedFirstFrame}）。
     */
    public boolean firstFrameNeedsStorageKey(String endpointId) {
        AiModelEndpoint p = requireEndpoint(endpointId);
        String model = (p.getModel() != null && !p.getModel().isBlank())
                ? p.getModel() : props.getDefaultModel();
        return usesUploadedFirstFrame(protocolFor(p, model));
    }

    /** 首帧要「先上传换 assetId」的协议（目前只有聚算媒体协议）。submit 与业务线判定共用这一处。 */
    static boolean usesUploadedFirstFrame(String protocol) {
        return PROTOCOL_JUSUAN_MEDIA.equals(protocol);
    }

    static String protocolFor(AiModelEndpoint p, String model) {
        String blob = ((p.getName() == null ? "" : p.getName()) + " "
                + (p.getBaseUrl() == null ? "" : p.getBaseUrl()) + " "
                + (model == null ? "" : model)).toLowerCase();
        if (blob.contains("seedance") || blob.contains("doubao-seedance")) return PROTOCOL_SEEDANCE;
        if (blob.contains("jusuanhub")) return PROTOCOL_JUSUAN_MEDIA;
        return blob.contains("agnes") ? PROTOCOL_AGNES : PROTOCOL_GENERIC;
    }

    /** 聚算 H3 当前开放 5..15 秒整数档；在提交前拒绝，避免服务端偷偷改时长或错扣积分。 */
    static int requireJusuanDuration(int durationSec) {
        if (durationSec < 5 || durationSec > 15) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "VIDEO_DURATION_UNSUPPORTED",
                    "MiniMax H3 单条视频仅支持 5 至 15 秒，请调整分镜时长后重试。");
        }
        return durationSec;
    }

    /**
     * 比例 → 聚算的 orientation。协议只有横 / 竖两档，**比例信息在这里必然丢失** ——
     * 3:4 与 9:16 都变成 portrait，实际出多少像素由厂商 preset 定（H3 竖屏是 768×1376）。
     * 所以能选什么必须由 {@link #videoGeometry} 在前端就限制住，不能让用户选一个
     * 我们注定兑现不了的比例（v0.184）。
     */
    static String orientationForAspect(String aspectRatio) {
        String ratio = aspectRatio == null ? "" : aspectRatio.trim();
        return "9:16".equals(ratio) || "3:4".equals(ratio) ? "portrait" : "landscape";
    }

    // ── 响应解析（多形态兜底） ──────────────────────────────────────────────────

    static String normalizeStatus(String raw) {
        if (raw == null) return "processing";
        String s = raw.trim().toLowerCase();
        return switch (s) {
            case "success", "succeed", "succeeded", "completed", "complete", "done", "finished", "ready" -> "succeeded";
            case "fail", "failed", "error", "cancelled", "canceled" -> "failed";
            default -> "processing"; // PROCESSING / RUNNING / SUBMITTED / QUEUED / pending …
        };
    }

    /**
     * 失败原因：上游 fail 时常见把原因放这些字段，抽出来回传给用户/运营，不再只给一句「status=failed」。
     *
     * <p>先找说人话的那句（顶层再 data），都没有才退到错误码 —— 聚算的失败任务是
     * {@code error: {code, message}}（对象）/ {@code errorMessage} / {@code errorCode} 这几种形态。
     */
    static String extractFailReason(JsonNode root) {
        if (root == null) return null;
        JsonNode data = root.get("data");
        String message = failMessageIn(root);
        if (message == null) message = failMessageIn(data);
        if (message != null) return message;
        String code = failCodeIn(root);
        return code != null ? code : failCodeIn(data);
    }

    private static String failMessageIn(JsonNode node) {
        if (node == null) return null;
        String direct = firstText(node, "fail_reason", "failReason", "error_message", "errorMessage",
                "error", "message", "msg", "reason", "detail");
        if (direct != null) return direct;
        JsonNode error = node.get("error");
        return error != null && error.isObject() ? firstText(error, "message", "msg", "detail", "reason") : null;
    }

    private static String failCodeIn(JsonNode node) {
        if (node == null) return null;
        String code = firstText(node, "errorCode", "error_code");
        if (code != null) return code;
        JsonNode error = node.get("error");
        return error != null && error.isObject() ? firstText(error, "code") : null;
    }

    /** 常见成片 URL 位置：video_result[0].url / data.video_url / output.video_url / videos[0].url / video_url / Agnes remixed_from_video_id。 */
    static String extractVideoUrl(JsonNode root) {
        String[] arrays = {"video_result", "videos", "results"};
        for (String key : arrays) {
            JsonNode arr = root.get(key);
            if (arr == null && root.get("data") != null) arr = root.get("data").get(key);
            if (arr != null && arr.isArray() && arr.size() > 0) {
                String u = firstText(arr.get(0), "url", "video_url", "videoUrl", "download_url");
                if (u != null) return u;
            }
        }
        String direct = firstText(root, "video_url", "videoUrl", "url", "download_url", "remixed_from_video_id");
        if (direct != null) return direct;
        // seedance（火山方舟）成片 URL 在 content.video_url。
        JsonNode content = root.get("content");
        if (content != null) {
            String c = firstText(content, "video_url", "videoUrl", "url", "download_url");
            if (c != null) return c;
        }
        JsonNode data = root.get("data");
        if (data != null) {
            String d = firstText(data, "video_url", "videoUrl", "url", "download_url", "remixed_from_video_id");
            if (d != null) return d;
        }
        JsonNode output = root.get("output");
        if (output != null) {
            String o = firstText(output, "video_url", "videoUrl", "url");
            if (o != null) return o;
            JsonNode vids = output.get("videos");
            if (vids != null && vids.isArray() && vids.size() > 0) {
                return firstText(vids.get(0), "url", "video_url");
            }
        }
        return null;
    }

    /**
     * 聚算媒体 Job 的产物是受保护资产，不允许自行拼对象存储 URL；轮询只抽 asset id，worker
     * 随后使用同一端点密钥读取 /assets/{id}/content 并镜像到我方 OSS。
     */
    static String extractOutputAssetId(JsonNode root) {
        if (root == null) return null;
        String direct = firstText(root, "output_asset_id", "outputAssetId", "result_asset_id", "resultAssetId");
        if (direct != null) return direct;
        for (String container : new String[] {"data", "output", "result"}) {
            JsonNode node = root.get(container);
            String nested = firstText(node, "output_asset_id", "outputAssetId", "result_asset_id", "resultAssetId",
                    "asset_id", "assetId");
            if (nested != null) return nested;
        }
        for (String array : new String[] {"output_assets", "assets", "results"}) {
            JsonNode values = root.get(array);
            if (values == null && root.get("data") != null) values = root.get("data").get(array);
            if (values != null && values.isArray() && !values.isEmpty()) {
                String nested = firstText(values.get(0), "asset_id", "assetId", "id");
                if (nested != null) return nested;
            }
        }
        return null;
    }

    /** 下载受保护的上游产物；只供 worker 镜像到我方 OSS，不把需鉴权的地址出 wire。 */
    public HttpResponse<java.nio.file.Path> downloadOutputAsset(SubmitResult submit, String assetId,
                                                                 java.nio.file.Path target)
            throws IOException, InterruptedException {
        if (submit == null || !submit.isJusuanMedia() || assetId == null || assetId.isBlank()) {
            throw new IOException("protected output asset is not available");
        }
        AiModelEndpoint endpoint = requireEndpoint(submit.endpointId());
        String apiKey = requireKey(endpoint);
        URI uri = jusuanScopedUri(endpoint.getBaseUrl(), "/assets/" + encodeQuery(assetId) + "/content",
                modelForScopedRequest(endpoint, submit));
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(Math.max(5, props.getDownloadTimeoutSeconds())))
                .header("Authorization", "Bearer " + apiKey)
                .GET()
                .build();
        return http.send(request, HttpResponse.BodyHandlers.ofFile(target));
    }

    private String modelForScopedRequest(AiModelEndpoint endpoint, SubmitResult submit) {
        if (submit != null && submit.modelUsed() != null && !submit.modelUsed().isBlank()) {
            return submit.modelUsed();
        }
        if (endpoint.getModel() != null && !endpoint.getModel().isBlank()) return endpoint.getModel();
        return props.getDefaultModel();
    }

    static URI jusuanScopedUri(String baseUrl, String path, String model) {
        return URI.create(joinUrl(baseUrl, path) + "?model=" + encodeQuery(model));
    }

    private static String extractThumb(JsonNode root) {
        JsonNode arr = root.get("video_result");
        if (arr != null && arr.isArray() && arr.size() > 0) {
            return firstText(arr.get(0), "cover_image_url", "cover_url", "thumbnail_url", "thumbnailUrl");
        }
        return firstText(root, "cover_image_url", "thumbnail_url", "thumbnailUrl");
    }

    static Integer extractProgressPct(JsonNode root) {
        Integer direct = firstProgress(root);
        if (direct != null) return direct;
        JsonNode data = root == null ? null : root.get("data");
        Integer dataProgress = firstProgress(data);
        if (dataProgress != null) return dataProgress;
        JsonNode output = root == null ? null : root.get("output");
        return firstProgress(output);
    }

    private static Integer firstProgress(JsonNode node) {
        if (node == null) return null;
        for (String key : new String[] {"progress_pct", "progressPct", "progress", "percent", "percentage"}) {
            JsonNode value = node.get(key);
            Integer pct = parseProgress(value);
            if (pct != null) return pct;
        }
        return null;
    }

    private static Integer parseProgress(JsonNode value) {
        if (value == null || value.isNull()) return null;
        double n;
        if (value.isNumber()) {
            n = value.asDouble();
        } else if (value.isTextual()) {
            String text = value.asText("").trim();
            if (text.isBlank()) return null;
            boolean hasPercent = text.endsWith("%");
            if (hasPercent) text = text.substring(0, text.length() - 1).trim();
            try {
                n = Double.parseDouble(text);
            } catch (NumberFormatException e) {
                return null;
            }
        } else {
            return null;
        }
        if (!Double.isFinite(n)) return null;
        if (!value.isTextual() && n >= 0 && n <= 1) n = n * 100;
        return Math.max(0, Math.min(100, (int) Math.round(n)));
    }

    static int normalizeFrames(int requested) {
        int n = Math.max(9, Math.min(441, requested));
        int rem = (n - 1) % 8;
        if (rem != 0) n = n + (8 - rem);
        return Math.min(441, n);
    }

    static Dimensions dimensionsForAspect(String aspectRatio) {
        String ratio = aspectRatio == null ? "" : aspectRatio.trim();
        return switch (ratio) {
            case "16:9" -> new Dimensions(1280, 720);
            case "1:1" -> new Dimensions(1024, 1024);
            case "4:3" -> new Dimensions(1024, 768);
            case "3:4" -> new Dimensions(768, 1024);
            default -> new Dimensions(720, 1280); // 9:16 竖屏短视频
        };
    }

    private static String firstText(JsonNode node, String... keys) {
        if (node == null) return null;
        for (String k : keys) {
            JsonNode v = node.get(k);
            if (v != null && !v.isNull() && v.isValueNode()) {
                String t = v.asText("");
                if (!t.isBlank()) return t;
            }
        }
        return null;
    }

    private static String extractFrameUrlHint(String prompt) {
        return extractUrlAfterMarker(prompt, "严格基于该首帧画面延展动态：");
    }

    /** v0.97 P2：尾帧 URL（DramaRenderService 以「并以该画面作为结尾帧：URL」marker 拼进 prompt）。 */
    private static String extractLastFrameUrlHint(String prompt) {
        return extractUrlAfterMarker(prompt, "并以该画面作为结尾帧：");
    }

    private static String extractUrlAfterMarker(String prompt, String marker) {
        if (prompt == null || prompt.isBlank()) return null;
        int idx = prompt.indexOf(marker);
        if (idx < 0) return null;
        int start = idx + marker.length();
        int end = prompt.indexOf('）', start);
        if (end < 0) end = prompt.indexOf(')', start);
        if (end < 0) end = prompt.length();
        String url = prompt.substring(start, end).trim();
        return url.startsWith("http://") || url.startsWith("https://") ? url : null;
    }

    /** 剥掉首/尾帧 marker（两者都在 prompt 末尾追加，从最早的 marker 处截断即覆盖两者）。 */
    private static String stripFrameUrlHint(String prompt) {
        if (prompt == null) return null;
        int cut = -1;
        for (String marker : new String[] {"（严格基于该首帧画面延展动态：", "（并以该画面作为结尾帧："}) {
            int idx = prompt.indexOf(marker);
            if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
        }
        return cut < 0 ? prompt : prompt.substring(0, cut).trim();
    }

    /** seedance 末帧 URL（content.last_frame_url）；其余形态在 data/output/result 下兜底。 */
    static String extractLastFrameUrl(JsonNode root) {
        if (root == null) return null;
        String direct = firstText(root, "last_frame_url", "lastFrameUrl", "tail_image_url");
        if (direct != null) return direct;
        for (String container : new String[] {"content", "data", "output", "result"}) {
            JsonNode c = root.get(container);
            if (c != null) {
                String u = firstText(c, "last_frame_url", "lastFrameUrl", "tail_image_url");
                if (u != null) return u;
            }
        }
        return null;
    }

    private static boolean isDefaultSubmitPath(String path) {
        return path == null || path.isBlank()
                || "/videos/generations".equals(path)
                || "/v1/videos/generations".equals(path);
    }

    private static boolean isDefaultPollPath(String path) {
        return path == null || path.isBlank()
                || "/async-result/{id}".equals(path)
                || "/v1/async-result/{id}".equals(path);
    }

    private static String joinUrl(String base, String path) {
        String b = rstrip(base, "/");
        String p = (path == null || path.isBlank()) ? "/" : path.trim();
        if (!p.startsWith("/")) p = "/" + p;
        if (b.endsWith("/v1") && p.startsWith("/v1/")) {
            return b + p.substring(3);
        }
        return b + p;
    }

    private static String apiRoot(String base) {
        String b = rstrip(base, "/");
        return b.endsWith("/v1") ? b.substring(0, b.length() - 3) : b;
    }

    private static String rstrip(String s, String suffix) {
        if (s == null) return "";
        String out = s.trim();
        while (out.endsWith(suffix)) out = out.substring(0, out.length() - suffix.length());
        return out;
    }

    private static String encodeQuery(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String snippet(String body) {
        if (body == null) return "";
        return body.length() > 300 ? body.substring(0, 300) + "…" : body;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    // ── 结果记录 ────────────────────────────────────────────────────────────────

    public record SubmitResult(String taskId, String videoId, String providerUsed, String modelUsed, String protocol,
                               String endpointId) {
        String externalId() {
            return (taskId != null && !taskId.isBlank()) ? taskId : videoId;
        }

        boolean isAgnes() {
            return PROTOCOL_AGNES.equals(protocol);
        }

        boolean isSeedance() {
            return PROTOCOL_SEEDANCE.equals(protocol);
        }

        boolean isJusuanMedia() {
            return PROTOCOL_JUSUAN_MEDIA.equals(protocol);
        }
    }

    public record PollResult(String status, String videoUrl, String thumbnailUrl, String rawStatus,
                             Integer progressPct, String failReason, String lastFrameUrl, String outputAssetId) {
        /** 兼容既有测试与 mock 构造。 */
        public PollResult(String status, String videoUrl, String thumbnailUrl, String rawStatus,
                          Integer progressPct, String failReason, String lastFrameUrl) {
            this(status, videoUrl, thumbnailUrl, rawStatus, progressPct, failReason, lastFrameUrl, null);
        }
        public boolean succeeded() { return "succeeded".equals(status); }
        public boolean failed() { return "failed".equals(status); }
    }

    record Dimensions(int width, int height) {}

    // ── 聚算：输入素材上传（v0.183 首帧；v0.199 起图 / 视频 / 音频）────────────────────────────
    //
    // 聚算的素材不能给 URL，得先传上去换一个 assetId：
    //   POST {base}/v1/assets/input?model=<公开别名>   multipart/form-data，字段名 image / video / audio
    //   201 → { "asset": { "assetId": "...", "status": "available", ... } }   （读 asset.assetId，不是顶层）
    // 再把 assetId 放进 input_image_asset_id / end_image_asset_id / referenceInputs[].assetId。
    // 与 seedance（火山）那条完全不同：那边是把图片 URL 塞进 content 数组。

    /** 判格式只需要文件头这么多字节；大文件不整个读进内存。 */
    private static final int SNIFF_HEAD_BYTES = 64;

    /**
     * 把一个素材传给聚算，返回 assetId。传不上去就**抛**，不静默退回文生视频 ——
     * 用户接了参考素材却出一条跟素材无关的片，比直接报错难排查得多（§8.0）。
     *
     * @param mediaType image / video / audio，同时就是 multipart 的字段名
     * @param maxBytes  这个位置的厂商上限（帧图 16 MiB、参考图 30、视频 50、音频 15，见 {@link JusuanH3Contract}）
     * @param label     报错里怎么称呼它（首帧图 / 尾帧图 / 图2 / 音频1 …），和任务卡上的编号一致
     */
    private String uploadInputAsset(AiModelEndpoint p, String apiKey, String model, String key,
                                    String mediaType, long maxBytes, String label) {
        Path local;
        long size;
        byte[] head;
        try {
            local = storage.openForRead(key);
            size = Files.size(local);
            try (InputStream in = Files.newInputStream(local)) {
                head = in.readNBytes(SNIFF_HEAD_BYTES);
            }
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UNREADABLE",
                    label + "读不出来，无法生成视频", "key=" + key + " err=" + e);
        }
        if (size > maxBytes) {
            throw BusinessException.badRequest("VIDEO_REF_TOO_LARGE",
                    label + "太大了（" + ceilMb(size) + "MB），不能超过 " + ceilMb(maxBytes) + "MB");
        }
        // 类型必须按**字节**判，不能按文件名（§8.0.1 ⑤）：画布出的图一律以 .png 落库，而厂商给的常常是 JPEG
        // （v0.184 实测：一张 JPEG 顶着 .png 传过去，聚算按我们声明的 image/png 解码，
        // 400 input image cannot be decoded）。store() 那边已经改成按字节存，但**存量文件仍是错的**，
        // 这里再判一次，老图不用重跑也能用。
        MediaBytes.Format fmt = MediaBytes.sniff(mediaType, head);
        if (fmt == null) {
            throw BusinessException.badRequest("VIDEO_REF_FORMAT_UNSUPPORTED",
                    label + "的格式不支持，请换成 " + String.join(" / ", JusuanH3Contract.formatsOf(mediaType)));
        }
        String filename = withExtension(local.getFileName().toString(), fmt.ext());

        String boundary = "----aistareco" + UUID.randomUUID().toString().replace("-", "");
        URI uri = URI.create(joinUrl(p.getBaseUrl(), "/v1/assets/input") + "?model=" + encodeQuery(model));
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    // 视频最大 50 MiB：按大文件的下载超时给，别用 JSON 调用那一档把大素材卡死。
                    .timeout(Duration.ofSeconds(Math.max(props.getHttpTimeoutSeconds(), props.getDownloadTimeoutSeconds())))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(multipartFile(boundary, mediaType, filename, fmt.mime(), local))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                // 上游拒绝时**必须**把它的原话留在日志里。只写一句「上传失败」的话，对着它分不出
                // 是 Key 没这个权限、路径不对、还是这个素材本身不合规 —— v0.166 已经在出图那条链上
                // 栽过一模一样的一次（`friendly()` 把所有非业务异常抹成「请稍后重试」）。
                log.warn("[material-video] 素材上传被拒 endpoint={} model={} url={} field={} bytes={} contentType={} status={} body={}",
                        p.getName(), model, uri, mediaType, size, fmt.mime(), resp.statusCode(), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        uploadFailureMessage(label, resp.statusCode(), resp.body()),
                        "status=" + resp.statusCode() + " url=" + uri + " body=" + snippet(resp.body()));
            }
            String assetId = OM.readTree(resp.body()).path("asset").path("assetId").asText(null);
            if (assetId == null || assetId.isBlank()) {
                log.warn("[material-video] 素材上传返回里没有 assetId endpoint={} field={} status={} body={}",
                        p.getName(), mediaType, resp.statusCode(), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        label + "上传失败，请稍后重试", "响应里没有 asset.assetId: " + snippet(resp.body()));
            }
            log.info("[material-video] 素材已上传 endpoint={} model={} field={} bytes={} contentType={} assetId={}",
                    p.getName(), model, mediaType, size, fmt.mime(), assetId);
            return assetId;
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "interrupted");
        } catch (Exception e) {
            log.warn("[material-video] 素材上传异常 endpoint={} field={} url={} err={}", p.getName(), mediaType, uri, e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    label + "上传失败，请稍后重试", "err=" + e);
        }
    }

    private static long ceilMb(long bytes) {
        long mib = 1024L * 1024L;
        return (bytes + mib - 1) / mib;
    }

    /** 手写 multipart：只有一个文件字段，不值得为它引一个 HTTP 客户端库。文件体直接从磁盘流出去。 */
    private static HttpRequest.BodyPublisher multipartFile(String boundary, String field, String filename,
                                                           String contentType, Path file) throws FileNotFoundException {
        String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + field + "\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        String tail = "\r\n--" + boundary + "--\r\n";
        return HttpRequest.BodyPublishers.concat(
                HttpRequest.BodyPublishers.ofByteArray(head.getBytes(StandardCharsets.UTF_8)),
                HttpRequest.BodyPublishers.ofFile(file),
                HttpRequest.BodyPublishers.ofByteArray(tail.getBytes(StandardCharsets.UTF_8)));
    }

    /** 把文件名的后缀换成真实格式的 —— 有的服务端除了 Content-Type 还会看文件名。 */
    static String withExtension(String filename, String ext) {
        String base = filename == null || filename.isBlank() ? "reference" : filename;
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        return base + "." + ext;
    }

    /** 按文件名猜类型。**不要**用它对外声明类型（文件名会骗人，见 uploadInputAsset）。 */
    static String contentTypeOf(String filename) {
        String f = filename == null ? "" : filename.toLowerCase();
        if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
        if (f.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    // ── 聚算：智能优化（POST {base}/media/prompt-optimizations，v0.199，docs/video-studio-plan.md §9）────────
    //
    // 同步接口，但厂商示例的读超时是 630 秒 —— 最长要等十分钟上下，所以调用方（视频生成区）把它做成后台任务。
    // 请求头 Idempotency-Key 必填且必须等于 body 的 clientRequestId；结果未知时用**同一正文同一键**重发。
    // 素材与生成一样先上传换 assetId（同一个 uploadInputAsset：字段名、按字节判类型、大小上限、编号文案）。

    /** 单次调用的读超时（厂商示例值）。 */
    static final Duration OPTIMIZE_ATTEMPT_TIMEOUT = Duration.ofSeconds(630);
    /**
     * 一次智能优化的总预算（从上传素材之前算起，含同一键重发）。必须小于视频生成区兜底回收的 20 分钟：
     * 每次调用的超时都按剩余预算截短，所以一个活着的调用一定在回收判它失败之前结束。
     * 素材上传不受预算截短（每个按 http-timeout，默认 30 秒 × 最多 13 个），只是用掉预算；
     * 上传本身超过预算时不再发起优化调用，直接按超时失败。
     */
    static final Duration OPTIMIZE_BUDGET = Duration.ofMinutes(12);
    private static final long OPTIMIZE_FIRST_BACKOFF_MS = 5_000L;
    private static final long OPTIMIZE_MAX_BACKOFF_MS = 60_000L;
    /** 剩余预算不到这么多就不再发起新的一次（发出去也等不到结果）。 */
    private static final long OPTIMIZE_MIN_ATTEMPT_MS = 1_000L;
    /** 有音频参考时必须带：保留音频、不让厂商「理解」它（照 Portal 示例）。 */
    static final String AUDIO_REFERENCE_POLICY = "preserve_without_understanding";

    /** 重试之间怎么等。生产就是 {@link Thread#sleep}；测试换成不真等的。 */
    interface Sleeper {
        void sleep(long millis) throws InterruptedException;
    }

    private Sleeper optimizeSleeper = Thread::sleep;
    private java.util.function.LongSupplier optimizeNanoClock = System::nanoTime;
    private Duration optimizeBudget = OPTIMIZE_BUDGET;

    /** 测试钩子：换掉等待、时钟与预算（不改生产行为）。 */
    void setOptimizeRetryHooksForTest(Sleeper sleeper, java.util.function.LongSupplier nanoClock, Duration budget) {
        this.optimizeSleeper = sleeper;
        this.optimizeNanoClock = nanoClock;
        this.optimizeBudget = budget;
    }

    /** 优化结果：优化后的完整提示词（必有）+ 厂商的 optimizationId（只用于排查）。 */
    public record OptimizeResult(String optimizedPrompt, String vendorOptimizationId) {}

    /**
     * 智能优化一段提示词。
     *
     * @param idempotencyKey 同时作为 Idempotency-Key 与 body 的 clientRequestId（视频生成区传它自己的记录 id，8–128 字符）
     * @param spec           必须是完整的原生规格（有清晰度、模式与素材匹配）；种子不看
     * @throws BusinessException 400 {@code VIDEO_MODE_UNSUPPORTED}：端点不是聚算媒体协议；
     *                           {@code VIDEO_STUDIO_OPTIMIZATION_REJECTED}：厂商 4xx（文案带厂商原话）；
     *                           {@code VIDEO_STUDIO_OPTIMIZATION_TIMEOUT}：重试预算用完；
     *                           {@code VIDEO_STUDIO_OPTIMIZATION_FAILED}：2xx 但没有优化结果；素材上传失败沿用 {@code VIDEO_REF_*}
     */
    public OptimizeResult optimizePrompt(String idempotencyKey, String originalPrompt, int seconds, String aspectRatio,
                                         String ownerUserId, String endpointId, VideoGenSpec spec) {
        VideoGenSpec genSpec = spec == null ? VideoGenSpec.EMPTY : spec;
        if (idempotencyKey == null || idempotencyKey.length() < 8 || idempotencyKey.length() > 128) {
            throw new IllegalArgumentException("idempotencyKey must be 8..128 chars");
        }
        AiModelEndpoint p = requireEndpoint(endpointId);
        String apiKey = requireKey(p);
        String model = modelOf(p);
        String protocol = protocolFor(p, model);
        if (!PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            throw BusinessException.badRequest("VIDEO_MODE_UNSUPPORTED", "所选视频模型不支持智能优化，请换一个视频模型");
        }
        if (!genSpec.isExplicit()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID", "智能优化缺少清晰度，无法提交");
        }
        requireProtocolSupports(protocol, genSpec, aspectRatio);

        // 预算从上传素材之前就开始算：最多 13 个素材、每个按 http-timeout 等，若只给「优化调用」计时，
        // 上传慢 + 重试满就可能超过兜底回收的 20 分钟。从这里算起，整个 worker 的耗时不超过 max(预算, 上传耗时)。
        long deadline = optimizeNanoClock.getAsLong() + optimizeBudget.toNanos();
        // 素材只上传一次：重发必须是「同一正文同一键」，换了 assetId 就不是同一个请求了。
        UpstreamInputs inputs = resolveUpstreamInputs(p, apiKey, model, protocol, genSpec);
        Map<String, Object> body = buildOptimizationBody(idempotencyKey, model, originalPrompt, seconds, aspectRatio,
                genSpec, inputs);
        String bodyJson;
        try {
            bodyJson = OM.writeValueAsString(body);
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_FAILED",
                    "智能优化失败，请稍后重试", "serialize body err=" + e);
        }
        URI uri = URI.create(joinUrl(p.getBaseUrl(), "/media/prompt-optimizations"));

        long backoffMs = OPTIMIZE_FIRST_BACKOFF_MS;
        String lastProblem = "no attempt";
        for (int attempt = 1; ; attempt++) {
            long remainingMs = (deadline - optimizeNanoClock.getAsLong()) / 1_000_000L;
            if (remainingMs < OPTIMIZE_MIN_ATTEMPT_MS) {
                log.warn("[material-video] 智能优化重试预算用完 endpoint={} key={} attempts={} last={}",
                        p.getName(), idempotencyKey, attempt - 1, lastProblem);
                throw BusinessException.wrapped(HttpStatus.GATEWAY_TIMEOUT, "VIDEO_STUDIO_OPTIMIZATION_TIMEOUT",
                        "智能优化超时", "key=" + idempotencyKey + " last=" + lastProblem);
            }
            Duration timeout = Duration.ofMillis(Math.min(OPTIMIZE_ATTEMPT_TIMEOUT.toMillis(), remainingMs));
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", idempotencyKey)
                    .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
                    .build();
            ModelCallCtx ctx = ModelCallCtx.builder(AiModelPurpose.VIDEO_GENERATION)
                    .endpoint(p.getId(), p.getName())
                    .model(model)
                    .requestId(idempotencyKey + "#" + attempt)
                    .ownerUserId(ownerUserId)
                    .appCode("celebrity")
                    .requestBodyJson(bodyJson)
                    // 优化是厂商单独计费的另一种调用，不记进「视频生成」的按秒用量（那张表按出片秒数算成本）。
                    .recordFailureUsage(false)
                    .client(http)
                    .build();
            HttpResponse<String> resp;
            try {
                resp = upstreamHttp.sendJson(req, ctx);
            } catch (UpstreamCallException ex) {
                if (ex.getCause() instanceof InterruptedException || Thread.currentThread().isInterrupted()) {
                    throw BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_STUDIO_OPTIMIZATION_TIMEOUT",
                            "智能优化被中断", "interrupted key=" + idempotencyKey);
                }
                lastProblem = (ex.isTimeout() ? "timeout " : "io ") + ex.getMessage();
                log.warn("[material-video] 智能优化调用没有结果，同一键重发 endpoint={} key={} attempt={} err={}",
                        p.getName(), idempotencyKey, attempt, lastProblem);
                backoffMs = pause(backoffMs, null, deadline);
                continue;
            }
            int status = resp.statusCode();
            if (status >= 200 && status < 300) {
                OptimizeResult result = parseOptimizationResponse(resp.body());
                if (result == null) {
                    log.warn("[material-video] 智能优化返回成功但没有优化结果 endpoint={} key={} status={} body={}",
                            p.getName(), idempotencyKey, status, snippet(resp.body()));
                    throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_FAILED",
                            "智能优化没有返回结果，请稍后重试", "status=" + status + " body=" + snippet(resp.body()));
                }
                log.info("[material-video] 智能优化完成 endpoint={} key={} attempt={} vendorId={} optimizedLength={}",
                        p.getName(), idempotencyKey, attempt, result.vendorOptimizationId(),
                        result.optimizedPrompt().length());
                return result;
            }
            if (status == 409 || status == 429 || status >= 500) {
                // 409 = 同一操作还在处理（optimization_in_progress）；429 / 5xx = 厂商忙。同一正文同一键重发。
                lastProblem = "status=" + status + " body=" + snippet(resp.body());
                log.warn("[material-video] 智能优化暂时没结果，同一键重发 endpoint={} key={} attempt={} status={} body={}",
                        p.getName(), idempotencyKey, attempt, status, snippet(resp.body()));
                backoffMs = pause(backoffMs, retryAfterMs(resp), deadline);
                continue;
            }
            log.warn("[material-video] 智能优化被拒 endpoint={} model={} key={} status={} body={}",
                    p.getName(), model, idempotencyKey, status, snippet(resp.body()));
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_STUDIO_OPTIMIZATION_REJECTED",
                    optimizationFailureMessage(status, resp.body()),
                    "status=" + status + " body=" + snippet(resp.body()));
        }
    }

    /** 等一会儿再重发：优先听 Retry-After，否则指数退避；不超过剩余预算。返回下一次的退避时长。 */
    private long pause(long backoffMs, Long retryAfterMs, long deadlineNanos) {
        long remainingMs = (deadlineNanos - optimizeNanoClock.getAsLong()) / 1_000_000L;
        long wait = Math.max(0L, Math.min(retryAfterMs != null ? retryAfterMs : backoffMs, remainingMs));
        try {
            optimizeSleeper.sleep(wait);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw BusinessException.wrapped(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_STUDIO_OPTIMIZATION_TIMEOUT",
                    "智能优化被中断", "interrupted while waiting to retry");
        }
        return Math.min(backoffMs * 2, OPTIMIZE_MAX_BACKOFF_MS);
    }

    /**
     * 厂商建议的重试间隔：先看 Retry-After 头（秒数形态；HTTP 日期形态不认），没有再看正文里的
     * {@code retryAfterSeconds}（顶层或 {@code error} / {@code error.details} 下）—— 聚算文档说的就是
     * 「Retry-After 或正文中的轮询建议」，两种都会出现。都没有 → null，退回指数退避。
     */
    static Long retryAfterMs(HttpResponse<String> resp) {
        String v = resp.headers().firstValue("Retry-After").orElse(null);
        if (v != null && !v.isBlank()) {
            try {
                long seconds = Long.parseLong(v.trim());
                if (seconds >= 0) return seconds * 1000L;
            } catch (NumberFormatException ignore) {
                // 日期形态：交给正文 / 指数退避
            }
        }
        try {
            JsonNode root = OM.readTree(resp.body() == null ? "" : resp.body());
            for (JsonNode n : new JsonNode[]{root.path("retryAfterSeconds"), root.path("error").path("retryAfterSeconds"),
                    root.path("error").path("details").path("retryAfterSeconds")}) {
                if (n.isNumber() && n.asDouble() >= 0) return Math.round(n.asDouble() * 1000d);
            }
        } catch (Exception ignore) {
            // 正文不是 JSON：没有建议
        }
        return null;
    }

    /**
     * 智能优化的请求体（照 Portal「智能优化后生成」示例）：
     * {@code clientRequestId, model, generationMode, originalPrompt,
     * mediaSpec{resolutionTier, orientation, aspectRatio, seconds, outputSizeCode}, referenceInputs[{role, assetId}],
     * [audioReferencePolicy]}。referenceInputs **不带 mediaType**；文生视频给空数组（字段必填）。
     * role：首帧生视频 first_frame；首尾帧 first_frame + last_frame；全能参考 reference_image / reference_video /
     * reference_audio（同生成的顺序）。有音频参考时加 audioReferencePolicy。
     */
    static Map<String, Object> buildOptimizationBody(String clientRequestId, String model, String originalPrompt,
                                                     int seconds, String aspectRatio, VideoGenSpec spec,
                                                     UpstreamInputs in) {
        requireProtocolSupports(PROTOCOL_JUSUAN_MEDIA, spec, aspectRatio);
        if (!spec.isExplicit()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_SPEC_INVALID", "智能优化缺少清晰度，无法提交");
        }
        JusuanH3Contract.Canvas canvas = JusuanH3Contract.canvas(spec.resolutionTier(), aspectRatio);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("clientRequestId", clientRequestId);
        body.put("model", model);
        body.put("generationMode", spec.generationMode());
        body.put("originalPrompt", nz(originalPrompt));
        Map<String, Object> mediaSpec = new LinkedHashMap<>();
        mediaSpec.put("resolutionTier", spec.resolutionTier());
        mediaSpec.put("orientation", JusuanH3Contract.orientation(canvas));
        mediaSpec.put("aspectRatio", canvas.aspectRatio());
        mediaSpec.put("seconds", requireJusuanDuration(seconds));
        mediaSpec.put("outputSizeCode", JusuanH3Contract.outputSizeCode(spec.resolutionTier(), canvas.aspectRatio()));
        body.put("mediaSpec", mediaSpec);
        List<Map<String, Object>> refs = new ArrayList<>();
        boolean hasAudio = false;
        switch (spec.generationMode()) {
            case JusuanH3Contract.MODE_I2V ->
                    refs.add(roleRef("first_frame", requireAsset(in.firstFrameAssetId(), "首帧图")));
            case JusuanH3Contract.MODE_FIRST_LAST_FRAME -> {
                refs.add(roleRef("first_frame", requireAsset(in.firstFrameAssetId(), "首帧图")));
                refs.add(roleRef("last_frame", requireAsset(in.lastFrameAssetId(), "尾帧图")));
            }
            case JusuanH3Contract.MODE_UNIVERSAL_REFERENCE -> {
                if (in.references().isEmpty()) requireAsset(null, "参考素材");
                for (ReferenceAsset r : in.references()) {
                    refs.add(roleRef(JusuanH3Contract.referenceRole(r.mediaType()), requireAsset(r.assetId(), "参考素材")));
                    hasAudio |= JusuanH3Contract.MEDIA_AUDIO.equals(r.mediaType());
                }
            }
            default -> { /* t2v：空数组，字段本身必填 */ }
        }
        body.put("referenceInputs", refs);
        if (hasAudio) body.put("audioReferencePolicy", AUDIO_REFERENCE_POLICY);
        return body;
    }

    private static Map<String, Object> roleRef(String role, String assetId) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("role", role);
        item.put("assetId", assetId);
        return item;
    }

    /** 读 {@code optimization.optimizedPrompt}（必有）与 optimizationId；也认放在顶层的形态。没有结果 / 不是 JSON → null。 */
    static OptimizeResult parseOptimizationResponse(String rawBody) {
        try {
            JsonNode root = OM.readTree(rawBody);
            if (root == null || !root.isObject()) return null;
            JsonNode opt = root.path("optimization");
            String prompt = firstText(opt, "optimizedPrompt");
            if (prompt == null) prompt = firstText(root, "optimizedPrompt");
            if (prompt == null || prompt.isBlank()) return null;
            String vendorId = firstText(opt, "optimizationId");
            if (vendorId == null) vendorId = firstText(root, "optimizationId");
            return new OptimizeResult(prompt, vendorId);
        } catch (Exception e) {
            return null;
        }
    }

    // ── 上游拒绝时给用户看的话（§8.0.1 ①）────────────────────────────
    //
    // 4xx 说的是「我们请求哪儿不对」，是用户唯一据以行动的信息：厂商原话直出（截断、脱敏）。
    // 对一个永远不会自己好的 400 说「请稍后重试」本身就是错的。5xx 是厂商自己的问题，只给状态码。
    // 响应体不是 JSON（网关的 HTML 错误页之类）时不外泄。上传与创建共用 vendorMessage 这一处解析。

    /** 素材上传被拒。 */
    static String uploadFailureMessage(String label, int status, String rawBody) {
        if (!isClientError(status)) return label + "上传失败（上游 " + status + "），请稍后重试";
        String msg = vendorMessage(rawBody);
        return msg == null ? label + "被上游拒收（" + status + "）" : label + "被上游拒收：" + msg;
    }

    /** 创建生成任务被拒（POST /media/generations 等）。 */
    static String submitFailureMessage(int status, String rawBody) {
        if (!isClientError(status)) return "视频生成失败（上游 " + status + "），请稍后重试";
        String msg = vendorMessage(rawBody);
        return msg == null ? "视频模型拒绝了这次请求（" + status + "）" : "视频模型拒绝了这次请求：" + msg;
    }

    /** 智能优化被拒（POST /media/prompt-optimizations 的 4xx；409 / 429 / 5xx 会重发，到不了这里）。 */
    static String optimizationFailureMessage(int status, String rawBody) {
        if (!isClientError(status)) return "智能优化失败（上游 " + status + "），请稍后重试";
        String msg = vendorMessage(rawBody);
        return msg == null ? "智能优化被拒（" + status + "）" : "智能优化被拒：" + msg;
    }

    private static boolean isClientError(int status) {
        return status >= 400 && status < 500;
    }

    private static final int VENDOR_MESSAGE_MAX_CHARS = 200;
    /** 脱敏：Bearer 凭据与看起来像密钥 / 签名的长串，不上屏。 */
    private static final Pattern BEARER = Pattern.compile("(?i)bearer\\s+\\S+");
    private static final Pattern LONG_TOKEN = Pattern.compile("[A-Za-z0-9_\\-]{32,}");

    /** 从上游错误体里取出厂商那句原话；不是 JSON、或没有可读的字段 → null。 */
    static String vendorMessage(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) return null;
        JsonNode body;
        try {
            body = OM.readTree(rawBody);
        } catch (Exception ignore) {
            return null;   // 网关的 HTML 错误页之类：退回笼统文案，别糊到界面上
        }
        if (body == null || !body.isObject()) return null;
        String msg = null;
        for (JsonNode c : new JsonNode[]{body.path("error").path("message"), body.path("message"),
                body.path("error").path("msg"), body.path("msg"), body.path("errorMessage"),
                body.path("detail"), body.path("error")}) {
            if (c.isTextual() && !c.asText().isBlank()) {
                msg = c.asText();
                break;
            }
        }
        if (msg == null) return null;
        msg = msg.replaceAll("\\s+", " ").trim();
        msg = LONG_TOKEN.matcher(BEARER.matcher(msg).replaceAll("***")).replaceAll("***");
        if (msg.codePointCount(0, msg.length()) > VENDOR_MESSAGE_MAX_CHARS) {
            msg = msg.substring(0, msg.offsetByCodePoints(0, VENDOR_MESSAGE_MAX_CHARS)) + "…";
        }
        return msg;
    }
}
