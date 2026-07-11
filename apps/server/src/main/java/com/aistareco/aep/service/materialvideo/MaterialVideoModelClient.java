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
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

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
    private static final int AGNES_FRAME_RATE = 24;

    private final AiModelInvocationService invocation;
    private final MaterialVideoProperties props;
    private final AiModelUsageService usage;
    private final UpstreamModelHttp upstreamHttp;
    private final HttpClient http;

    public MaterialVideoModelClient(AiModelInvocationService invocation,
                                    MaterialVideoProperties props,
                                    AiModelUsageService usage,
                                    UpstreamModelHttp upstreamHttp) {
        this.invocation = invocation;
        this.props = props;
        this.usage = usage;
        this.upstreamHttp = upstreamHttp;
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

    /**
     * 提交一个生成任务，返回外部 task_id + 实际用到的端点 / model。appCode 用于用量归属（drama / celebrity）。
     * D-11：endpointId 非空 → 用指定候选端点（白名单，未命中抛 ENDPOINT_NOT_ALLOWED）；为空 → 默认端点（旧路径不变）。
     * 返回的 {@link SubmitResult} 带上 endpointId，使后续 poll 落到同一端点（同 baseUrl/apiKey）。
     */
    public SubmitResult submit(String prompt, int durationSec, String aspectRatio, String ownerUserId,
                               String appCode, String endpointId) {
        AiModelEndpoint p = requireEndpoint(endpointId);
        String apiKey = requireKey(p);
        String model = (p.getModel() != null && !p.getModel().isBlank())
                ? p.getModel() : props.getDefaultModel();
        String protocol = protocolFor(p, model);

        Map<String, Object> body = buildSubmitBody(protocol, model, prompt, durationSec, aspectRatio);

        URI uri = URI.create(joinUrl(p.getBaseUrl(), submitPathFor(protocol)));
        long startNanos = System.nanoTime();
        String requestId = "vid-" + UUID.randomUUID().toString().substring(0, 16);
        log.info("[material-video] submit start endpoint={} model={} protocol={} path={} durationSec={} aspectRatio={} promptLength={}",
                p.getName(), model, protocol, uri.getPath(), durationSec, aspectRatio, prompt == null ? 0 : prompt.length());

        HttpRequest req;
        try {
            req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
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
            String taskId = firstText(root, "id", "task_id", "request_id", "taskId");
            String videoId = firstText(root, "video_id", "videoId");
            if (taskId == null) {
                JsonNode data = root.get("data");
                if (data != null) taskId = firstText(data, "id", "task_id", "request_id", "taskId");
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
            return new SubmitResult(taskId, videoId, p.getName(), model, protocol, endpointId);
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
            return new PollResult(status, videoUrl, thumb, rawStatus, progressPct, failReason, lastFrameUrl);
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

    private Map<String, Object> buildSubmitBody(String protocol, String model, String prompt,
                                                int durationSec, String aspectRatio) {
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
        String path = props.getPollPathTemplate().replace("{id}", submit.externalId());
        return URI.create(joinUrl(p.getBaseUrl(), path));
    }

    private String protocolFor(AiModelEndpoint p, String model) {
        String blob = ((p.getName() == null ? "" : p.getName()) + " "
                + (p.getBaseUrl() == null ? "" : p.getBaseUrl()) + " "
                + (model == null ? "" : model)).toLowerCase();
        if (blob.contains("seedance") || blob.contains("doubao-seedance")) return PROTOCOL_SEEDANCE;
        return blob.contains("agnes") ? PROTOCOL_AGNES : PROTOCOL_GENERIC;
    }

    // ── 响应解析（多形态兜底） ──────────────────────────────────────────────────

    static String normalizeStatus(String raw) {
        if (raw == null) return "processing";
        String s = raw.trim().toLowerCase();
        return switch (s) {
            case "success", "succeed", "succeeded", "completed", "complete", "done", "finished" -> "succeeded";
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
    }

    public record PollResult(String status, String videoUrl, String thumbnailUrl, String rawStatus,
                             Integer progressPct, String failReason, String lastFrameUrl) {
        public boolean succeeded() { return "succeeded".equals(status); }
        public boolean failed() { return "failed".equals(status); }
    }

    record Dimensions(int width, int height) {}
}
