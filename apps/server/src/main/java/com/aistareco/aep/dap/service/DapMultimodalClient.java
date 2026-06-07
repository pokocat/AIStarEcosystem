package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

/**
 * 数字人资产平台多模态客户端 —— dap 领域唯一外部大模型出口。
 *
 * 接入点由「admin → 平台与配置 → AI 模型与 Key + AI 应用绑定」统一管理(v0.51 修订 #4 +
 * v0.54),按用途路由:
 *   · chat   → DAP_PERSONA  → POST {baseUrl}/v1/chat/completions   OpenAI 兼容
 *   · image  → DAP_IMAGE    → POST {baseUrl}/v1/images/generations OpenAI Images 兼容
 *                                            (i2i 走 extra_body.image=[url|dataURI])
 *   · video  → DAP_VIDEO    → POST {baseUrl}/v1/videos             异步 submit + poll
 *                              + GET  {baseUrl}/v1/videos/{taskId}
 *
 * 任一用途未绑定启用端点 → isConfigured()=false,调用方按 aep.dap.allow-placeholder
 * 配合 DapJobService.requireEngineOrPlaceholderAllowed() 二选一:
 *   · allow-placeholder=false(prod 默认) → submit 直接 503 DAP_ENGINE_NOT_CONFIGURED
 *   · allow-placeholder=true (dev 默认)  → 调用方自行降级占位产物 + mock 标记
 *
 * 历史命名:本类此前叫 AgnesClient(品牌耦合),v0.54 起改名并删除 env(AGNES_API_KEY +
 * aep.dap.agnes.*)兜底分支,与「大模型统一 server 端 admin 管理」原则对齐。
 */
@Service
public class DapMultimodalClient {

    private static final Logger log = LoggerFactory.getLogger(DapMultimodalClient.class);
    private static final ObjectMapper OM = new ObjectMapper();

    private final DapProperties props;
    private final AiModelInvocationService aiModels;
    private final HttpClient http;

    public DapMultimodalClient(DapProperties props, AiModelInvocationService aiModels) {
        this.props = props;
        this.aiModels = aiModels;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    // ── 接入点解析(admin 端点为唯一真源)─────────────────────────

    /** 一次调用的落地目标:baseUrl 不带尾斜杠;apiKey 明文(仅内存);source 用于日志。 */
    record Target(String baseUrl, String apiKey, String model, String source) {}

    private Target resolveTarget(AiModelPurpose purpose) {
        AiModelEndpoint e = aiModels.resolveEndpoint(purpose).orElse(null);
        if (e == null) return null;
        try {
            String key = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
            if (key == null || key.isBlank()) {
                log.warn("[dap-ai] endpoint key blank purpose={} endpoint={} → unconfigured",
                        purpose.wire(), e.getName());
                return null;
            }
            String model = e.getModel() != null && !e.getModel().isBlank() ? e.getModel() : null;
            if (model == null) {
                log.warn("[dap-ai] endpoint model blank purpose={} endpoint={} → unconfigured",
                        purpose.wire(), e.getName());
                return null;
            }
            return new Target(rstrip(e.getBaseUrl()), key, model, "endpoint:" + e.getName());
        } catch (Exception ex) {
            log.warn("[dap-ai] endpoint decrypt failed purpose={} endpoint={} err={} → unconfigured",
                    purpose.wire(), e.getName(), ex.getMessage());
            return null;
        }
    }

    private Target chatTarget()  { return resolveTarget(AiModelPurpose.DAP_PERSONA); }
    private Target imageTarget() { return resolveTarget(AiModelPurpose.DAP_IMAGE); }
    private Target videoTarget() { return resolveTarget(AiModelPurpose.DAP_VIDEO); }

    /** 图片 + 文本任一通道可用即视为已配置(视频是衍生能力,运行链路按各自通道再精确判定)。 */
    public boolean isConfigured() {
        return aiModels.hasEndpointFor(AiModelPurpose.DAP_IMAGE)
                || aiModels.hasEndpointFor(AiModelPurpose.DAP_PERSONA);
    }

    public String imageModel() {
        Target t = imageTarget();
        return t != null ? t.model() : null;
    }

    public String videoModel() {
        Target t = videoTarget();
        return t != null ? t.model() : null;
    }

    public String chatModel() {
        Target t = chatTarget();
        return t != null ? t.model() : null;
    }

    // ── 文本 ───────────────────────────────────────────────────

    /** 单轮 chat;返回 assistant content。 */
    public String chat(String systemPrompt, String userPrompt) {
        Target t = require(chatTarget(), "chat");
        ObjectNode body = OM.createObjectNode();
        body.put("model", t.model());
        ArrayNode messages = body.putArray("messages");
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.addObject().put("role", "system").put("content", systemPrompt);
        }
        messages.addObject().put("role", "user").put("content", userPrompt);
        body.put("temperature", 0.6);

        JsonNode resp = postJson(t, "/v1/chat/completions", body);
        JsonNode content = resp.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "chat 响应缺少 choices[0].message.content");
        }
        return content.asText();
    }

    /** chat 并解析 JSON 产物(剥 markdown 围栏 + 截取首个 {...})。 */
    public JsonNode chatJson(String systemPrompt, String userPrompt) {
        String raw = chat(systemPrompt, userPrompt);
        String cleaned = extractJson(raw);
        try {
            return OM.readTree(cleaned);
        } catch (IOException e) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "chat 输出不是合法 JSON: " + truncate(raw, 300));
        }
    }

    // ── 图片 ───────────────────────────────────────────────────

    /**
     * 生成 / 编辑图片,返回图片字节。
     *
     * @param prompt      英文 prompt(调用方负责翻译)
     * @param size        如 768x1024;null 用模型默认
     * @param inputImages i2i 输入(公网 URL 或 data:image/...;base64,xxx),空 = 文生图
     */
    public byte[] generateImage(String prompt, String size, List<String> inputImages) {
        Target t = require(imageTarget(), "image");
        ObjectNode body = OM.createObjectNode();
        body.put("model", t.model());
        body.put("prompt", prompt);
        if (size != null && !size.isBlank()) body.put("size", size);
        ObjectNode extra = body.putObject("extra_body");
        extra.put("response_format", "url");
        if (inputImages != null && !inputImages.isEmpty()) {
            ArrayNode arr = extra.putArray("image");
            inputImages.forEach(arr::add);
        }

        JsonNode resp = postJson(t, "/v1/images/generations", body);
        JsonNode data0 = resp.path("data").path(0);
        String url = data0.path("url").asText(null);
        if (url != null && !url.isBlank()) {
            return download(url, 64 * 1024 * 1024);
        }
        String b64 = data0.path("b64_json").asText(null);
        if (b64 != null && !b64.isBlank()) {
            return Base64.getDecoder().decode(b64);
        }
        throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "images 响应缺少 data[0].url / b64_json: " + truncate(resp.toString(), 300));
    }

    // ── 视频(异步)────────────────────────────────────────────

    /** progress:云端真实进度 0-100(响应缺失时为 null,调用方自行兜底)。 */
    public record VideoTask(String taskId, String status, String videoUrl, Integer progress, String raw) {}

    /**
     * 创建视频任务。
     *
     * @param prompt     英文 prompt
     * @param inputImage i2v 输入(URL / dataURI),null = 文生视频
     */
    public String createVideoTask(String prompt, String inputImage, int width, int height,
                                  int numFrames, int frameRate) {
        Target t = require(videoTarget(), "video");
        ObjectNode body = OM.createObjectNode();
        body.put("model", t.model());
        body.put("prompt", prompt);
        body.put("width", width);
        body.put("height", height);
        body.put("num_frames", normalizeFrames(numFrames));
        body.put("frame_rate", frameRate);
        if (inputImage != null && !inputImage.isBlank()) {
            body.put("image", inputImage);
        }
        JsonNode resp = postJson(t, "/v1/videos", body);
        String taskId = firstNonBlank(
                resp.path("id").asText(null),
                resp.path("task_id").asText(null),
                resp.path("data").path("id").asText(null),
                resp.path("data").path("task_id").asText(null));
        if (taskId == null) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "videos 响应缺少任务 id: " + truncate(resp.toString(), 300));
        }
        log.info("[dap-ai] video-task created taskId={} model={} size={}x{} frames={} fps={}",
                taskId, t.model(), width, height, normalizeFrames(numFrames), frameRate);
        return taskId;
    }

    /** 查询视频任务(status 归一化为 queued|in_progress|completed|failed)。 */
    public VideoTask getVideoTask(String taskId) {
        Target t = require(videoTarget(), "video");
        JsonNode resp = getJson(t, "/v1/videos/" + taskId);
        String status = firstNonBlank(
                resp.path("status").asText(null),
                resp.path("data").path("status").asText(null),
                "in_progress").toLowerCase();
        // 常见别名归一
        if (status.contains("succ") || status.equals("done") || status.equals("complete")) status = "completed";
        if (status.contains("fail") || status.equals("error")) status = "failed";
        if (status.equals("processing") || status.equals("running") || status.equals("pending")) status = "in_progress";

        String videoUrl = firstNonBlank(
                resp.path("video_url").asText(null),
                resp.path("url").asText(null),
                resp.path("data").path("video_url").asText(null),
                resp.path("data").path("url").asText(null),
                resp.path("output").path("video_url").asText(null));
        Integer progress = null;
        JsonNode pn = resp.path("progress").isMissingNode() ? resp.path("data").path("progress") : resp.path("progress");
        if (pn.isNumber()) {
            double pv = pn.asDouble();
            progress = (int) Math.round(pv <= 1.0 && pv > 0 ? pv * 100 : pv); // 兼容 0-1 / 0-100 两种形态
        }
        return new VideoTask(taskId, status, videoUrl, progress, resp.toString());
    }

    /** 阻塞轮询直到 completed/failed/超时;onPoll 每轮收到云端真实任务态(status / progress)。 */
    public VideoTask awaitVideo(String taskId, java.util.function.Consumer<VideoTask> onPoll) {
        int interval = Math.max(2, props.getVideo().getPollIntervalSeconds());
        int maxWait = Math.max(30, props.getVideo().getMaxWaitSeconds());
        long deadline = System.currentTimeMillis() + maxWait * 1000L;
        long start = System.currentTimeMillis();
        String lastStatus = null;
        long lastHeartbeat = 0L;
        while (System.currentTimeMillis() < deadline) {
            VideoTask t = getVideoTask(taskId);
            long now = System.currentTimeMillis();
            if (!t.status().equals(lastStatus) || now - lastHeartbeat >= 60_000L) {
                log.info("[dap-ai] video-task poll taskId={} status={} progress={} elapsedSec={} maxWaitSec={} videoUrlPresent={}",
                        taskId, t.status(), t.progress(), (now - start) / 1000L, maxWait,
                        t.videoUrl() != null && !t.videoUrl().isBlank());
                lastStatus = t.status();
                lastHeartbeat = now;
            }
            if ("completed".equals(t.status()) || "failed".equals(t.status())) return t;
            if (onPoll != null) onPoll.accept(t);
            try {
                Thread.sleep(interval * 1000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new DapModelException("DAP_MODEL_INTERRUPTED", "视频轮询被中断");
            }
        }
        throw new DapModelException("DAP_MODEL_TIMEOUT", "视频生成超时(>" + maxWait + "s),任务 " + taskId);
    }

    // ── 通用 HTTP ──────────────────────────────────────────────

    public byte[] download(String url, long maxBytes) {
        long startNanos = System.nanoTime();
        log.info("[dap-ai] download start host={} maxBytes={}", hostOf(url), maxBytes);
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(Math.max(60, props.getHttp().getTimeoutSeconds())))
                    .GET().build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 400) {
                log.warn("[dap-ai] download http-error host={} status={} durationMs={}",
                        hostOf(url), resp.statusCode(), elapsedMs(startNanos));
                throw new DapModelException("DAP_MODEL_DOWNLOAD_FAILED", "下载产物失败 HTTP " + resp.statusCode() + " " + url);
            }
            byte[] body = resp.body();
            if (body.length > maxBytes) {
                log.warn("[dap-ai] download too-large host={} bytes={} maxBytes={} durationMs={}",
                        hostOf(url), body.length, maxBytes, elapsedMs(startNanos));
                throw new DapModelException("DAP_MODEL_DOWNLOAD_TOO_LARGE", "产物超出大小上限: " + body.length + " bytes");
            }
            log.info("[dap-ai] download ok host={} status={} bytes={} durationMs={}",
                    hostOf(url), resp.statusCode(), body.length, elapsedMs(startNanos));
            return body;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("[dap-ai] download exception host={} durationMs={} err={}",
                    hostOf(url), elapsedMs(startNanos), e.toString());
            throw new DapModelException("DAP_MODEL_DOWNLOAD_FAILED", "下载产物失败: " + e.getMessage());
        }
    }

    private JsonNode postJson(Target t, String path, ObjectNode body) {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(joinUrl(t.baseUrl(), path)))
                    .timeout(Duration.ofSeconds(props.getHttp().getTimeoutSeconds()))
                    .header("Authorization", "Bearer " + t.apiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                    .build();
            return sendForJson(req, path, t.source(), summarizeRequest(body));
        } catch (IOException e) {
            throw new DapModelException("DAP_MODEL_CALL_FAILED", "请求体序列化失败: " + e.getMessage());
        }
    }

    private JsonNode getJson(Target t, String path) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(joinUrl(t.baseUrl(), path)))
                .timeout(Duration.ofSeconds(props.getHttp().getTimeoutSeconds()))
                .header("Authorization", "Bearer " + t.apiKey())
                .GET().build();
        return sendForJson(req, path, t.source(), null);
    }

    /** 发送 + 解析 JSON;IOException 自动重试 1 次;入参 / 返回 全量打日志(key 不打、dataURI 只打长度)。 */
    private JsonNode sendForJson(HttpRequest req, String path, String source, String requestSummary) {
        int maxAttempts = 2;
        for (int attempt = 1; ; attempt++) {
            long startNanos = System.nanoTime();
            log.info("[dap-ai] call start method={} path={} operation={} host={} source={} attempt={}/{} request={}",
                    req.method(), path, operationFromPath(req), req.uri().getHost(), source, attempt, maxAttempts,
                    requestSummary == null ? "-" : requestSummary);
            try {
                HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() >= 400) {
                    log.warn("[dap-ai] call http-error method={} path={} operation={} status={} durationMs={} request={} body={}",
                            req.method(), path, operationFromPath(req), resp.statusCode(), elapsedMs(startNanos),
                            requestSummary == null ? "-" : requestSummary, truncate(resp.body(), 600));
                    throw new DapModelException("DAP_MODEL_HTTP_" + resp.statusCode(),
                            "大模型调用失败 HTTP " + resp.statusCode() + "(" + path + "): " + truncate(resp.body(), 200));
                }
                log.info("[dap-ai] call ok method={} path={} operation={} status={} durationMs={} bytes={} response={}",
                        req.method(), path, operationFromPath(req), resp.statusCode(), elapsedMs(startNanos),
                        resp.body() == null ? 0 : resp.body().length(), truncate(resp.body(), 600));
                return OM.readTree(resp.body());
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                    throw new DapModelException("DAP_MODEL_CALL_FAILED", "大模型调用被中断(" + path + ")");
                }
                boolean willRetry = attempt < maxAttempts;
                log.warn("[dap-ai] call exception method={} path={} operation={} durationMs={} attempt={}/{} willRetry={} request={} err={}",
                        req.method(), path, operationFromPath(req), elapsedMs(startNanos), attempt, maxAttempts,
                        willRetry, requestSummary == null ? "-" : requestSummary, e.toString());
                if (!willRetry) {
                    throw new DapModelException("DAP_MODEL_CALL_FAILED", "大模型调用失败(" + path + "): " + e.getMessage());
                }
                try {
                    Thread.sleep(1200L);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new DapModelException("DAP_MODEL_CALL_FAILED", "大模型调用被中断(" + path + ")");
                }
            }
        }
    }

    private Target require(Target t, String channel) {
        if (t == null) {
            throw new DapModelException("DAP_ENGINE_NOT_CONFIGURED",
                    "未配置生成引擎(" + channel + "):请在管理后台「AI 模型与 Key + AI 应用绑定」为对应用途绑定启用端点");
        }
        return t;
    }

    /** 请求体 debug 摘要:文本字段截断;image 输入 dataURI 只打 mime+长度,URL 原样(不含 key)。 */
    static String summarizeRequest(ObjectNode body) {
        try {
            ObjectNode copy = body.deepCopy();
            // chat messages content 截断
            JsonNode messages = copy.path("messages");
            if (messages.isArray()) {
                for (JsonNode m : messages) {
                    if (m instanceof ObjectNode mo && mo.path("content").isTextual()) {
                        mo.put("content", truncate(mo.path("content").asText(), 400));
                    }
                }
            }
            if (copy.path("prompt").isTextual()) {
                copy.put("prompt", truncate(copy.path("prompt").asText(), 400));
            }
            // i2i 输入:extra_body.image[] / image
            JsonNode extra = copy.path("extra_body");
            if (extra instanceof ObjectNode eo && eo.path("image").isArray()) {
                ArrayNode arr = (ArrayNode) eo.path("image");
                ArrayNode replaced = eo.putArray("image");
                arr.forEach(n -> replaced.add(summarizeImageInput(n.asText())));
            }
            if (copy.path("image").isTextual()) {
                copy.put("image", summarizeImageInput(copy.path("image").asText()));
            }
            return copy.toString();
        } catch (Exception e) {
            return "(summarize-failed: " + e.getMessage() + ")";
        }
    }

    static String summarizeImageInput(String input) {
        if (input == null) return null;
        if (input.startsWith("data:")) {
            int comma = input.indexOf(',');
            String head = comma > 0 ? input.substring(0, comma) : "data:?";
            return head + " len=" + input.length();
        }
        return truncate(input, 200);
    }

    /** base(可带可不带 /v1)+ path(以 /v1/ 开头)→ 不重复 /v1 的完整 URL。 */
    static String joinUrl(String base, String path) {
        String b = rstrip(base);
        if (b.endsWith("/v1") && path.startsWith("/v1/")) {
            return b + path.substring(3);
        }
        return b + path;
    }

    private static String rstrip(String s) {
        if (s == null) return "";
        String out = s.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }

    private static int normalizeFrames(int requested) {
        // num_frames 必须满足 8n+1 且 <= 441
        int n = Math.max(9, Math.min(441, requested));
        int rem = (n - 1) % 8;
        if (rem != 0) n = n - rem;
        return n;
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static String extractJson(String raw) {
        String s = raw.trim();
        if (s.startsWith("```")) {
            int firstNl = s.indexOf('\n');
            if (firstNl > 0) s = s.substring(firstNl + 1);
            int fence = s.lastIndexOf("```");
            if (fence >= 0) s = s.substring(0, fence);
            s = s.trim();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return s.substring(start, end + 1);
        return s;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static String hostOf(String url) {
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return "invalid-url";
        }
    }

    private static String operationFromPath(HttpRequest req) {
        String path = req.uri().getPath();
        if (path.endsWith("/chat/completions")) return "chat";
        if (path.endsWith("/images/generations")) return "image";
        if (path.endsWith("/videos")) return "video";
        if (path.contains("/videos/")) return "video-status";
        return "other";
    }

    /** dap 大模型调用异常(runner 捕获后落 job.errorMessage + 释放冻结积分)。 */
    public static class DapModelException extends RuntimeException {
        private final String code;
        public DapModelException(String code, String message) {
            super(message);
            this.code = code;
        }
        public String getCode() { return code; }
    }
}
