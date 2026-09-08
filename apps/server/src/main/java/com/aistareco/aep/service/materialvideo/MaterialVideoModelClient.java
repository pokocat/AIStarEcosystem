package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.storage.ImageBytes;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

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
        String model = endpoint.getModel() != null && !endpoint.getModel().isBlank()
                ? endpoint.getModel() : props.getDefaultModel();
        String protocol = protocolFor(endpoint, model);
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol)) return new DurationBounds(5, 15);
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
     * 提交生成任务。{@code firstFrameKey} 是首帧参考图的存储键（聚算 H3 走 i2v）——
     * 传 null 就是纯文生视频。
     *
     * <p>刻意**不留**一个不带首帧的重载：同一件事两种调法，迟早有人用了少一个参数的那个，
     * 参考图就这么悄悄丢了（今天已经在别处栽过两次）。不需要参考图就显式传 null。
     */
    public SubmitResult submit(String prompt, int durationSec, String aspectRatio, String ownerUserId,
                               String appCode, String endpointId, String firstFrameKey) {
        AiModelEndpoint p = requireEndpoint(endpointId);
        String apiKey = requireKey(p);
        String model = (p.getModel() != null && !p.getModel().isBlank())
                ? p.getModel() : props.getDefaultModel();
        String protocol = protocolFor(p, model);

        // 聚算的图不是给 URL、而是**先上传拿 assetId**（POST /v1/assets/input?model=…）——
        // 这跟 seedance 那条「把 URL 塞进 content 数组」完全不同的协议。
        // 之前这里一律发 generationMode=t2v、图一张都没送 —— 用户接了参考图，
        // 出来的片跟参考图毫无关系（v0.183）。
        String assetId = null;
        if (firstFrameKey != null && !firstFrameKey.isBlank() && PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            assetId = uploadInputImage(p, apiKey, model, firstFrameKey);
        }

        Map<String, Object> body = buildSubmitBody(protocol, model, prompt, durationSec, aspectRatio, assetId);

        URI uri = URI.create(joinUrl(p.getBaseUrl(), submitPathFor(protocol)));
        long startNanos = System.nanoTime();
        String requestId = "vid-" + UUID.randomUUID().toString().substring(0, 16);
        log.info("[material-video] submit start endpoint={} model={} protocol={} path={} durationSec={} aspectRatio={} promptLength={}",
                p.getName(), model, protocol, uri.getPath(), durationSec, aspectRatio, prompt == null ? 0 : prompt.length());

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
                .requestBodyJson(bodyJson)
                .client(http)
                .build();
        HttpResponse<String> resp;
        try {
            resp = upstreamHttp.sendJson(req, ctx);
        } catch (UpstreamCallException ex) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成失败，请稍后重试",
                    "endpoint=" + p.getName() + " err=" + ex.getCause());
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成失败，请稍后重试",
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
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频生成失败，请稍后重试",
                        "missing task/video id; endpoint=" + p.getName() + " body=" + snippet(resp.body()));
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
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成失败，请稍后重试",
                    "endpoint=" + p.getName() + " err=" + e);
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

    Map<String, Object> buildSubmitBody(String protocol, String model, String prompt,
                                        int durationSec, String aspectRatio) {
        return buildSubmitBody(protocol, model, prompt, durationSec, aspectRatio, null);
    }

    Map<String, Object> buildSubmitBody(String protocol, String model, String prompt,
                                        int durationSec, String aspectRatio, String inputImageAssetId) {
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
            String first = extractFrameUrlHint(prompt);
            if (first != null && !first.isBlank()) content.add(seedanceImage(first, "first_frame"));
            String last = extractLastFrameUrlHint(prompt);
            if (last != null && !last.isBlank()) content.add(seedanceImage(last, "last_frame"));
            body.put("content", content);
            if (aspectRatio != null && !aspectRatio.isBlank()) body.put("ratio", aspectRatio);
            if (durationSec > 0) body.put("duration", durationSec);
            body.put("return_last_frame", true);
            return body;
        }

        // 首/尾帧 marker 由 vars 拼进 prompt（DramaRenderService），这里抽出来作结构化入参，
        // 并把 marker 文本从 prompt 里剥掉，避免把 URL 原样喂给模型当文字。
        body.put("prompt", nz(stripFrameUrlHint(prompt)));

        if (PROTOCOL_AGNES.equals(protocol)) {
            Dimensions size = dimensionsForAspect(aspectRatio);
            body.put("width", size.width());
            body.put("height", size.height());
            body.put("num_frames", normalizeFrames((durationSec > 0 ? durationSec : props.getDefaultDurationSec()) * AGNES_FRAME_RATE));
            body.put("frame_rate", AGNES_FRAME_RATE);
            String image = extractFrameUrlHint(prompt);
            if (image != null && !image.isBlank()) body.put("image", image);
            return body;
        }

        // 聚算 JusuanHub 统一媒体协议：受控规格字段替代 width/height/fps 等原始运行时参数。
        // 参考图不能给 URL —— 必须先 POST /v1/assets/input 换 assetId（v0.183 已接通，见
        // uploadInputImage）。尾帧 / 多参考图（end_image_asset_id、referenceInputs）仍未接，
        // 所以候选能力里的 supportsFirstLastFrame 继续如实标 false。
        if (PROTOCOL_JUSUAN_MEDIA.equals(protocol)) {
            body.put("prompt", nz(stripFrameUrlHint(prompt)));
            body.put("resolutionTier", "768p");
            body.put("orientation", orientationForAspect(aspectRatio));
            body.put("seconds", requireJusuanDuration(durationSec));
            // 有首帧就走图生视频；没有才是纯文生视频。
            // generationMode 是 H3 的必填项，取值 t2v | i2v | first_last_frame_video |
            // universal_reference_video（见聚算 createMediaGeneration 文档）。
            if (inputImageAssetId != null && !inputImageAssetId.isBlank()) {
                body.put("generationMode", "i2v");
                body.put("input_image_asset_id", inputImageAssetId);
            } else {
                body.put("generationMode", "t2v");
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
        String firstFrame = extractFrameUrlHint(prompt);
        if (firstFrame != null && !firstFrame.isBlank()) body.put("image", firstFrame);
        String lastFrame = extractLastFrameUrlHint(prompt);
        if (lastFrame != null && !lastFrame.isBlank()) body.put("end_image", lastFrame);
        return body;
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

    /** 失败原因：上游 fail 时常见把原因放这些字段，抽出来回传给用户/运营，不再只给一句「status=failed」。 */
    static String extractFailReason(JsonNode root) {
        String direct = firstText(root, "fail_reason", "failReason", "error_message", "errorMessage",
                "error", "message", "msg", "reason", "detail");
        if (direct != null && !direct.isBlank()) return direct;
        JsonNode data = root.get("data");
        if (data != null) {
            String d = firstText(data, "fail_reason", "failReason", "error_message", "errorMessage",
                    "error", "message", "msg", "reason", "detail");
            if (d != null && !d.isBlank()) return d;
        }
        return null;
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
            case "16:9" -> new Dimensions(1152, 768);
            case "1:1" -> new Dimensions(1024, 1024);
            case "4:3" -> new Dimensions(1024, 768);
            case "3:4" -> new Dimensions(768, 1024);
            default -> new Dimensions(768, 1152); // 9:16 竖屏短视频
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

    // ── 聚算：输入素材上传（v0.183）────────────────────────────
    //
    // 聚算的图不能给 URL，得先传上去换一个 assetId：
    //   POST {base}/v1/assets/input?model=<公开别名>   multipart/form-data，字段名 image
    //   201 → { "asset": { "assetId": "...", "status": "available", ... } }
    // 再把 assetId 放进 createMediaGeneration 的 input_image_asset_id。
    // 与 seedance（火山）那条完全不同：那边是把图片 URL 塞进 content 数组。

    /** 图片上限：文档给的是一般 16 MiB / H3 30 MiB，这里按小的那个挡，够用且不会踩到任何一档。 */
    private static final int JUSUAN_IMAGE_MAX_BYTES = 16 * 1024 * 1024;

    /** 聚算收的静态图格式（文档：PNG / JPEG / WebP）。 */
    private static final java.util.Set<String> JUSUAN_IMAGE_MIMES =
            java.util.Set.of("image/png", "image/jpeg", "image/webp");

    /**
     * 把首帧图传给聚算，返回 assetId。传不上去就**抛**，不静默退回文生视频 ——
     * 用户接了参考图却出一条跟参考图无关的片，比直接报错难排查得多（§8.0）。
     */
    private String uploadInputImage(AiModelEndpoint p, String apiKey, String model, String key) {
        byte[] bytes;
        String filename;
        try {
            java.nio.file.Path local = storage.openForRead(key);
            bytes = java.nio.file.Files.readAllBytes(local);
            filename = local.getFileName().toString();
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UNREADABLE",
                    "参考图读不出来，无法生成视频", "key=" + key + " err=" + e);
        }
        if (bytes.length > JUSUAN_IMAGE_MAX_BYTES) {
            throw BusinessException.badRequest("VIDEO_REF_TOO_LARGE",
                    "参考图太大（" + (bytes.length / 1024 / 1024) + "MB），请换一张 16MB 以内的");
        }
        // 类型必须按**字节**判，不能按文件名：画布出的图一律以 .png 落库，而厂商给的常常是 JPEG
        // （v0.184 实测：一张 JPEG 顶着 .png 传过去，聚算按我们声明的 image/png 解码，
        // 400 input image cannot be decoded）。store() 那边已经改成按字节存，但**存量文件仍是错的**，
        // 这里再判一次，老图不用重跑也能用。
        ImageBytes.Format fmt = ImageBytes.sniff(bytes);
        if (fmt == null || !JUSUAN_IMAGE_MIMES.contains(fmt.mime())) {
            throw BusinessException.badRequest("VIDEO_REF_FORMAT_UNSUPPORTED",
                    "这张参考图的格式不支持，请换一张 JPG / PNG / WebP 图片"
                            + (fmt == null ? "" : "（当前是 " + fmt.ext() + "）"));
        }
        filename = withExtension(filename, fmt.ext());

        String boundary = "----aistareco" + UUID.randomUUID().toString().replace("-", "");
        byte[] payload = multipartImage(boundary, filename, fmt.mime(), bytes);
        URI uri = URI.create(joinUrl(p.getBaseUrl(), "/v1/assets/input")
                + "?model=" + java.net.URLEncoder.encode(model, java.nio.charset.StandardCharsets.UTF_8));
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                // 上游拒绝时**必须**把它的原话留在日志里。只写一句「上传失败」的话，对着它分不出
                // 是 Key 没这个权限、路径不对、还是这张图本身不合规 —— v0.166 已经在出图那条链上
                // 栽过一模一样的一次（`friendly()` 把所有非业务异常抹成「请稍后重试」）。
                log.warn("[material-video] 参考图上传被拒 endpoint={} model={} url={} bytes={} contentType={} status={} body={}",
                        p.getName(), model, uri, bytes.length, fmt.mime(),
                        resp.statusCode(), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        uploadFailureMessage(resp.statusCode(), resp.body()),
                        "status=" + resp.statusCode() + " url=" + uri + " body=" + snippet(resp.body()));
            }
            String assetId = OM.readTree(resp.body()).path("asset").path("assetId").asText(null);
            if (assetId == null || assetId.isBlank()) {
                log.warn("[material-video] 参考图上传返回里没有 assetId endpoint={} status={} body={}",
                        p.getName(), resp.statusCode(), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                        "参考图上传失败，请稍后重试", "响应里没有 asset.assetId: " + snippet(resp.body()));
            }
            log.info("[material-video] 参考图已上传 endpoint={} model={} bytes={} assetId={}",
                    p.getName(), model, bytes.length, assetId);
            return assetId;
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    "参考图上传失败，请稍后重试", "interrupted");
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_REF_UPLOAD_FAILED",
                    "参考图上传失败，请稍后重试", "err=" + e);
        }
    }

    /** 手写 multipart：只有一个 image 字段，不值得为它引一个 HTTP 客户端库。 */
    private static byte[] multipartImage(String boundary, String filename, String contentType, byte[] bytes) {
        String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"image\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        String tail = "\r\n--" + boundary + "--\r\n";
        byte[] h = head.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] t = tail.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] out = new byte[h.length + bytes.length + t.length];
        System.arraycopy(h, 0, out, 0, h.length);
        System.arraycopy(bytes, 0, out, h.length, bytes.length);
        System.arraycopy(t, 0, out, h.length + bytes.length, t.length);
        return out;
    }

    /** 把文件名的后缀换成真实格式的 —— 有的服务端除了 Content-Type 还会看文件名。 */
    static String withExtension(String filename, String ext) {
        String base = filename == null || filename.isBlank() ? "reference" : filename;
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        return base + "." + ext;
    }

    /** 按文件名猜类型。**不要**用它对外声明类型（文件名会骗人，见 uploadInputImage）。 */
    static String contentTypeOf(String filename) {
        String f = filename == null ? "" : filename.toLowerCase();
        if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
        if (f.endsWith(".webp")) return "image/webp";
        return "image/png";
    }

    /** 上游拒绝上传时给用户看的话：4xx 直出厂商原话（是我们请求哪儿不对，用户据此才有得改），5xx 笼统。 */
    static String uploadFailureMessage(int status, String rawBody) {
        if (status >= 500) return "参考图上传失败（上游 " + status + "），请稍后重试";
        String msg = null;
        try {
            JsonNode body = OM.readTree(rawBody);
            for (JsonNode c : new JsonNode[]{body.path("error").path("message"), body.path("message"),
                    body.path("error").path("msg"), body.path("msg")}) {
                if (c.isTextual() && !c.asText().isBlank()) { msg = c.asText().trim(); break; }
            }
        } catch (Exception ignore) {
            // 不是 JSON（网关的 HTML 错误页之类）：退回笼统文案，别把一页 HTML 糊到界面上
        }
        if (msg == null || msg.isBlank()) return "参考图被上游拒收（" + status + "）";
        if (msg.length() > 200) msg = msg.substring(0, 200) + "…";
        return "参考图被上游拒收：" + msg;
    }
}
