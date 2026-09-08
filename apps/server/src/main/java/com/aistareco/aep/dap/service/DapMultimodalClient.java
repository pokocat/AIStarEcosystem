package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
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
import java.util.UUID;

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
    private final AiModelUsageService usage;
    private final UpstreamModelHttp upstreamHttp;
    private final HttpClient http;

    public DapMultimodalClient(DapProperties props,
                               AiModelInvocationService aiModels,
                               AiModelUsageService usage,
                               UpstreamModelHttp upstreamHttp) {
        this.props = props;
        this.aiModels = aiModels;
        this.usage = usage;
        this.upstreamHttp = upstreamHttp;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    // ── 接入点解析(admin 端点为唯一真源)─────────────────────────

    /** 一次调用的落地目标:baseUrl 不带尾斜杠;apiKey 明文(仅内存);source 用于日志。 */
    record Target(String endpointId, String endpointName, String baseUrl, String apiKey,
                  String model, String source, AiModelPurpose purpose,
                  /** 该端点声明的出图最小像素数；null = 无下限。 */
                  Integer minImagePixels) {}

    private Target resolveTarget(AiModelPurpose purpose) {
        return resolveTarget(purpose, null);
    }

    /**
     * 指定端点解析。
     *
     * <p>{@code endpointId} 非空时走候选白名单（{@code ai_app_endpoint_candidate}）——
     * 不在白名单里**不静默回退默认**，直接 503 `ENDPOINT_NOT_ALLOWED`（D-11 的既有纪律）。
     * 用户在画布上选了模型却被悄悄换成另一个，比报错更糟：他按那个模型的价付了钱。
     */
    private Target resolveTarget(AiModelPurpose purpose, String endpointId) {
        var resolved = (endpointId == null || endpointId.isBlank())
                ? java.util.Optional.<com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint>empty()
                : aiModels.resolveEndpoint(purpose, endpointId);
        AiModelEndpoint e = (endpointId == null || endpointId.isBlank())
                ? aiModels.resolveEndpoint(purpose).orElse(null)
                : resolved.map(r -> r.endpoint()).orElse(null);
        Integer minPixels = resolved.map(r -> r.candidate() == null ? null : r.candidate().getMinImagePixels()).orElse(null);
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
            return new Target(e.getId(), e.getName(), rstrip(e.getBaseUrl()), key, model,
                    "endpoint:" + e.getName(), purpose, minPixels);
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

    /**
     * 带图 chat（视觉理解）—— 用户照片 → 人物特征卡（v0.151 AI IP 工作台）。
     *
     * <p>走 OpenAI 兼容的 content-parts 形态：
     * {@code content: [{type:"text",text}, {type:"image_url",image_url:{url}}]}。
     * {@code imageInputs} 的元素是公网 URL 或 {@code data:image/...;base64,...}
     * （由 {@link DapImageInput#of(String)} 从 storage key 派生）。
     *
     * <p>上游模型不支持视觉时会以 HTTP 4xx 回来，本方法原样抛
     * {@code DAP_MODEL_HTTP_4xx}：调用方负责翻成业务错误码并**不产假产物**（§8.0）。
     */
    public String chatWithImages(String systemPrompt, String userPrompt, List<String> imageInputs) {
        Target t = require(chatTarget(), "chat");
        ObjectNode body = OM.createObjectNode();
        body.put("model", t.model());
        ArrayNode messages = body.putArray("messages");
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.addObject().put("role", "system").put("content", systemPrompt);
        }
        ObjectNode userMsg = messages.addObject();
        userMsg.put("role", "user");
        ArrayNode parts = userMsg.putArray("content");
        parts.addObject().put("type", "text").put("text", userPrompt == null ? "" : userPrompt);
        if (imageInputs != null) {
            for (String img : imageInputs) {
                if (img == null || img.isBlank()) continue;
                ObjectNode part = parts.addObject();
                part.put("type", "image_url");
                part.putObject("image_url").put("url", img);
            }
        }
        body.put("temperature", 0.4);

        JsonNode resp = postJson(t, "/v1/chat/completions", body);
        JsonNode content = resp.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "chat 响应缺少 choices[0].message.content");
        }
        // 部分兼容实现把 content 也回成 parts 数组，取首个 text 段
        if (content.isArray()) {
            for (JsonNode part : content) {
                if (part.path("text").isTextual()) return part.path("text").asText();
            }
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "chat 响应 content 数组里没有文本段");
        }
        return content.asText();
    }

    /** 带图 chat 并解析 JSON 产物（剥 markdown 围栏 + 截取首个 {...}）。 */
    public JsonNode chatJsonWithImages(String systemPrompt, String userPrompt, List<String> imageInputs) {
        String raw = chatWithImages(systemPrompt, userPrompt, imageInputs);
        String cleaned = extractJson(raw);
        try {
            return OM.readTree(cleaned);
        } catch (IOException e) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "带图 chat 输出不是合法 JSON: " + truncate(raw, 300));
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
        return generateImage(prompt, size, inputImages, null);
    }

    /** 同上，但用指定端点（画布上的模型下拉；null = 后台默认端点）。 */
    public byte[] generateImage(String prompt, String size, List<String> inputImages, String endpointId) {
        Target t = require(resolveTarget(AiModelPurpose.DAP_IMAGE, endpointId), "image");
        String requestId = "dap-img-" + UUID.randomUUID().toString().substring(0, 12);
        long startNanos = System.nanoTime();
        ObjectNode body = OM.createObjectNode();
        body.put("model", t.model());
        body.put("prompt", prompt);
        String effectiveSize = fitMinPixels(size, t.minImagePixels());
        if (effectiveSize != null && !effectiveSize.isBlank()) body.put("size", effectiveSize);
        if (effectiveSize != null && !effectiveSize.equals(size)) {
            log.info("[dap-ai] 画幅按端点下限上调 endpoint={} {} → {}（下限 {} 像素）",
                    t.endpointName(), size, effectiveSize, t.minImagePixels());
        }
        // 参考图与出图格式**必须放顶层**（v0.170）。
        //
        // 此前只塞在 extra_body 里。`extra_body` 是 OpenAI **Python SDK** 的约定 ——
        // SDK 会把它摊平进顶层 body；而我们是直接发原始 JSON，那它就只是个厂商不认识的
        // 嵌套对象。火山方舟的文档里 image / response_format / watermark 全是顶层参数，
        // 于是**参考图根本没送到**，而且不报错（image 是可选的）——
        // 表现就是「出的图跟我上传的照片一点不像」，查日志还能看到 image 明明在请求里。
        //
        // 顶层与 extra_body 同时给：agnes 那条链一直是按 extra_body 读的，
        // 贸然只留顶层会把已经在用的端点弄坏；多带一份未知字段厂商会忽略。
        body.put("response_format", "url");
        // 火山默认 watermark=true，会在成图上打自己的水印。
        body.put("watermark", false);
        ObjectNode extra = body.putObject("extra_body");
        extra.put("response_format", "url");
        if (inputImages != null && !inputImages.isEmpty()) {
            // 单张参考图用**裸字符串**，多张才用数组 —— 官方「图生图」示例就是
            // `"image": "https://…"`。类型标的是 string / string[]，理论上数组也收，
            // 但单图场景照着示例的形状发最稳，省得在「为什么没参考上」里再多一个变量。
            if (inputImages.size() == 1) {
                body.put("image", inputImages.get(0));
            } else {
                ArrayNode top = body.putArray("image");
                inputImages.forEach(top::add);
            }
            ArrayNode arr = extra.putArray("image");
            inputImages.forEach(arr::add);
        }

        try {
            JsonNode resp;
            try {
                resp = postJson(t, "/v1/images/generations", body);
            } catch (DapModelException e) {
                // 厂商在 4xx 里直接说了画幅下限（火山方舟：`image size must be at least 3686400 pixels`）。
                // 它已经把答案给我们了 —— 让用户回后台填一个像素数、或者去画布上把每个节点挨个改，
                // 都是把厂商说过的话再让人复述一遍。按它说的改一次再试，只重试一次。
                String retrySize = sizeFromMinPixelsHint(e.getMessage(), effectiveSize);
                if (retrySize == null) throw e;
                log.warn("[dap-ai] 画幅被上游拒绝，按它给的下限改一次再试 endpoint={} {} → {}",
                        t.endpointName(), effectiveSize, retrySize);
                body.put("size", retrySize);
                resp = postJson(t, "/v1/images/generations", body);
            }
            JsonNode data0 = resp.path("data").path(0);
            String upstreamId = resp.path("id").asText(null);
            String url = data0.path("url").asText(null);
            byte[] out;
            if (url != null && !url.isBlank()) {
                out = download(url, 64 * 1024 * 1024);
            } else {
                String b64 = data0.path("b64_json").asText(null);
                if (b64 == null || b64.isBlank()) {
                    throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "images 响应缺少 data[0].url / b64_json: " + truncate(resp.toString(), 300));
                }
                out = Base64.getDecoder().decode(b64);
            }
            recordMetered(t, AiModelBillingMode.PER_CALL, 1L, 0L, true,
                    requestId, upstreamId, elapsedMs(startNanos), null, null);
            return out;
        } catch (DapModelException e) {
            recordMetered(t, AiModelBillingMode.PER_CALL, 0L, 0L, false,
                    requestId, null, elapsedMs(startNanos), e.getCode(), e.getMessage());
            throw e;
        }
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
        String requestId = "dap-vid-" + UUID.randomUUID().toString().substring(0, 12);
        long startNanos = System.nanoTime();
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
        try {
            JsonNode resp = postJson(t, "/v1/videos", body);
            String taskId = firstNonBlank(
                    resp.path("id").asText(null),
                    resp.path("task_id").asText(null),
                    resp.path("data").path("id").asText(null),
                    resp.path("data").path("task_id").asText(null));
            if (taskId == null) {
                throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "videos 响应缺少任务 id: " + truncate(resp.toString(), 300));
            }
            long seconds = secondsForFrames(normalizeFrames(numFrames), frameRate);
            recordMetered(t, AiModelBillingMode.PER_SECOND, 1L, seconds, true,
                    requestId, taskId, elapsedMs(startNanos), null, null);
            log.info("[dap-ai] video-task created taskId={} model={} size={}x{} frames={} fps={}",
                    taskId, t.model(), width, height, normalizeFrames(numFrames), frameRate);
            return taskId;
        } catch (DapModelException e) {
            recordMetered(t, AiModelBillingMode.PER_SECOND, 0L, 0L, false,
                    requestId, null, elapsedMs(startNanos), e.getCode(), e.getMessage());
            throw e;
        }
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
            if ("completed".equals(t.status()) || "failed".equals(t.status())) {
                if ("failed".equals(t.status())) {
                    log.warn("[dap-ai] video-task FAILED taskId={} progress={} raw={}",
                            taskId, t.progress(), truncate(t.raw(), 600));
                }
                return t;
            }
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
            return sendForJson(req, t, path, summarizeRequest(body));
        } catch (IOException e) {
            throw new DapModelException("DAP_MODEL_CALL_FAILED", "请求体序列化失败: " + e.getMessage());
        }
    }

    private JsonNode getJson(Target t, String path) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(joinUrl(t.baseUrl(), path)))
                .timeout(Duration.ofSeconds(props.getHttp().getTimeoutSeconds()))
                .header("Authorization", "Bearer " + t.apiKey())
                .GET().build();
        return sendForJson(req, t, path, null);
    }

    private void recordMetered(Target t,
                               AiModelBillingMode mode,
                               long units,
                               long seconds,
                               boolean success,
                               String requestId,
                               String upstreamId,
                               long latencyMs,
                               String errorCode,
                               String errorMessage) {
        try {
            usage.recordMeteredObserved(
                    t.endpointId(),
                    t.endpointName(),
                    t.model(),
                    t.purpose().name(),
                    0L,
                    0L,
                    0L,
                    mode,
                    success ? Math.max(0L, units) : 0L,
                    success ? Math.max(0L, seconds) : 0L,
                    success,
                    requestId,
                    upstreamId,
                    latencyMs,
                    errorCode,
                    errorMessage);
        } catch (Exception ignored) {
            // usage 是观测旁路，不影响 DAP 生成主链路。
        }
    }

    /**
     * 发送 + 解析 JSON。v0.85：HTTP 发送 / 原始日志 / 非 2xx WARN / IOException 退避重试统一走共享原语
     * {@link UpstreamModelHttp#sendJson}（dataURI 大字段经 {@code summarizeRequest} 脱敏后作为 io 日志的请求体）。
     *
     * dap 的用量流水仍由各调用方（{@code generateImage} / {@code createVideoTask}）按 metered 计费记录
     * （成功带 units/seconds、失败 units=0），故此处 {@code recordFailureUsage(false)}，不重复落库。
     * 对外异常码保持不变：HTTP 错误 → DAP_MODEL_HTTP_{status}；网络层失败 / 中断 → DAP_MODEL_CALL_FAILED。
     */
    private JsonNode sendForJson(HttpRequest req, Target t, String path, String requestSummary) {
        ModelCallCtx ctx = ModelCallCtx.builder(t.purpose())
                .endpoint(t.endpointId(), t.endpointName())
                .model(t.model())
                .requestId("dap-" + UUID.randomUUID().toString().substring(0, 12))
                .requestBodyJson(requestSummary)
                .client(http)
                .maxAttempts(2)
                .retryBackoffMs(1200L)
                .recordFailureUsage(false)
                .build();
        HttpResponse<String> resp;
        try {
            resp = upstreamHttp.sendJson(req, ctx);
        } catch (UpstreamCallException ex) {
            throw new DapModelException("DAP_MODEL_CALL_FAILED",
                    "大模型调用失败(" + path + "): " + (ex.getCause() == null ? ex.getMessage() : ex.getCause().getMessage()));
        }
        if (resp.statusCode() >= 400) {
            throw new DapModelException("DAP_MODEL_HTTP_" + resp.statusCode(), upstreamMessage(resp));
        }
        try {
            return OM.readTree(resp.body());
        } catch (IOException e) {
            throw new DapModelException("DAP_MODEL_BAD_OUTPUT", "大模型返回不是合法 JSON(" + path + "): " + e.getMessage());
        }
    }

    /** 上游 4xx 里报出的画幅下限，例如 {@code image size must be at least 3686400 pixels}。 */
    private static final java.util.regex.Pattern MIN_PIXELS_HINT =
            java.util.regex.Pattern.compile("at least\\s+(\\d{5,9})\\s*pixels", java.util.regex.Pattern.CASE_INSENSITIVE);

    /**
     * 从上游的拒绝理由里读出画幅下限，算出该改成多大。
     *
     * <p>只在**它确实说了下限、而我们发的确实比这个小**时才返回新画幅；其余一律返回 null（照常抛错）。
     * 这不是「失败了就重试」—— 同一个请求重试多少次都还是同样的错；这是**按对方给的信息改正一次**。
     */
    static String sizeFromMinPixelsHint(String upstreamMessage, String sentSize) {
        if (upstreamMessage == null || sentSize == null) return null;
        java.util.regex.Matcher m = MIN_PIXELS_HINT.matcher(upstreamMessage);
        if (!m.find()) return null;
        int min;
        try {
            min = Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
        String fixed = fitMinPixels(sentSize, min);
        return fixed == null || fixed.equals(sentSize) ? null : fixed;
    }

    /**
     * 按端点声明的最小像素把画幅顶上去（保持比例）。
     *
     * <p>不同模型对画幅的要求差得很远：火山方舟 seedream 4.5 要求 ≥3686400 像素（约 1920×1920），
     * 而 agnes 用 768×1024 就行。画布上的画幅是**逐节点**存的（模板还给写死了 768×1024），
     * 换一个模型就得把画布上每个节点挨个改一遍 —— 那不是用户该干的活。
     *
     * <p>只往上调、不往下调；端点没声明下限就原样返回，行为与此前完全一致。
     * 边长按 8 对齐（多数出图模型要求能被 8 或 16 整除）。
     */
    static String fitMinPixels(String size, Integer minPixels) {
        if (size == null || minPixels == null || minPixels <= 0) return size;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^(\\d+)x(\\d+)$").matcher(size.trim());
        if (!m.matches()) return size;   // "1:1" 这种比例值交给上游自己解释
        long w = Long.parseLong(m.group(1));
        long h = Long.parseLong(m.group(2));
        if (w <= 0 || h <= 0 || w * h >= minPixels) return size;
        double factor = Math.sqrt((double) minPixels / (double) (w * h));
        long nw = align8(Math.ceil(w * factor));
        long nh = align8(Math.ceil(h * factor));
        // 对齐时向下取整可能又掉到下限以下，补一格
        while (nw * nh < minPixels) { nw += 8; nh = align8(Math.ceil(nw * (double) h / (double) w)); }
        return nw + "x" + nh;
    }

    private static long align8(double v) {
        long n = (long) Math.ceil(v);
        long r = n % 8;
        return r == 0 ? n : n + (8 - r);
    }

    /** 上游 4xx 响应体里那句人话的最大长度 —— 够说清问题，又不至于把整段 JSON 糊到界面上。 */
    private static final int UPSTREAM_MSG_MAX = 200;

    /**
     * 给用户看的上游失败原因。
     *
     * <p>此前一律返回「AI 生成失败，请稍后重试」，理由是「不把上游响应体直出给用户」。
     * 方向对，做过头了：OpenAI 兼容的厂商对 **4xx** 回的是结构化的 {@code {code,message}}，
     * 而且那句 message 恰恰是**我们请求哪里不对**——
     * 比如 {@code unsupported FLUX.2 Klein 4B size "768x1024"}（换了模型之后画幅不被支持）。
     * 把它抹成「请稍后重试」，用户既不知道该改什么，而且那句话本身还是错的
     * （上游明确 {@code retryable:false}，重试永远不会成）。
     *
     * <p>分寸：**4xx 直出厂商那句 message**（是我们的请求造成的，可操作），截断到 200 字；
     * **5xx 保持笼统 + 状态码**（厂商自己出问题，用户做不了什么，细节在 WARN 日志里）。
     */
    private static String upstreamMessage(HttpResponse<String> resp) {
        int status = resp.statusCode();
        if (status >= 500) return "模型服务暂时不可用（上游 " + status + "），请稍后重试";
        String msg = null;
        try {
            JsonNode body = OM.readTree(resp.body());
            for (JsonNode candidate : new JsonNode[]{body.path("error").path("message"), body.path("message")}) {
                if (candidate.isTextual() && !candidate.asText().isBlank()) { msg = candidate.asText().trim(); break; }
            }
        } catch (Exception ignore) {
            // 响应体不是 JSON：退回笼统文案，别把 HTML 错误页糊到界面上
        }
        if (msg == null || msg.isBlank()) return "模型拒绝了这次请求（上游 " + status + "）";
        if (msg.length() > UPSTREAM_MSG_MAX) msg = msg.substring(0, UPSTREAM_MSG_MAX) + "…";
        return "模型拒绝了这次请求：" + msg;
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
                    } else if (m instanceof ObjectNode mo && mo.path("content").isArray()) {
                        // v0.151 带图 chat 的 content-parts：dataURI 只打 mime + 长度，
                        // 否则一张照片能把一行 io 日志撑到几百 KB。
                        for (JsonNode part : mo.path("content")) {
                            if (!(part instanceof ObjectNode po)) continue;
                            if (po.path("text").isTextual()) {
                                po.put("text", truncate(po.path("text").asText(), 400));
                            }
                            if (po.path("image_url") instanceof ObjectNode iu && iu.path("url").isTextual()) {
                                iu.put("url", summarizeImageInput(iu.path("url").asText()));
                            }
                        }
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

    /**
     * 日志里的图片输入摘要。
     *
     * <p>**签名 URL 绝不进日志**（AGENTS.md v0.150 红线）：OSS / CDN 的时效签名带在 query 上
     * （{@code ?Expires=…&Signature=…} / {@code ?auth_key=…}），原样打进日志等于把任何人都能
     * 直接下载原图的凭据写进日志文件与日志采集链路。所以 http(s) 输入只留
     * scheme + host + path，query 整段丢掉。dataURI 只留头部与长度（base64 本体是用户照片）。
     */
    public static String summarizeImageInput(String input) {
        if (input == null) return null;
        if (input.startsWith("data:")) {
            int comma = input.indexOf(',');
            String head = comma > 0 ? input.substring(0, comma) : "data:?";
            return head + " len=" + input.length();
        }
        if (input.startsWith("http://") || input.startsWith("https://")) {
            int q = input.indexOf('?');
            String noQuery = q >= 0 ? input.substring(0, q) : input;
            // 片段（#）里同样可能带凭据，一并砍掉
            int hash = noQuery.indexOf('#');
            if (hash >= 0) noQuery = noQuery.substring(0, hash);
            return truncate(noQuery, 200) + (q >= 0 ? "?<redacted>" : "");
        }
        return truncate(input, 200);
    }

    /** base(可带可不带 /v1)+ path(以 /v1/ 开头)→ 不重复 /v1 的完整 URL。 */
    /**
     * 拼出真正要请求的地址。
     *
     * <p>本仓有两套 base_url 约定，历史原因：通用调用层（{@code AiModelInvocationService}）
     * 拼的是 {@code {base}/chat/completions}，即 base 里**已经含版本段**（火山方舟就是
     * {@code .../api/v3}）；这里拼的是 {@code {base}/v1/images/generations}，即 base 是**主机根**
     * （agnes 就是 {@code https://api.agnes-ai.cn}）。同一个端点满足不了两边。
     *
     * <p>真实踩过的三种填法，全部 404：
     * <pre>
     * .../api/v3/images/generations → .../api/v3/images/generations/v1/images/generations
     * .../api/v3/images            → .../api/v3/images/v1/images/generations
     * .../api/v3                   → .../api/v3/v1/images/generations   ← 这个填法是对的，也照样失败
     * </pre>
     * 最后一条尤其要命：**用户按文档填对了，仍然不通**，因为火山方舟的图片接口是
     * {@code /api/v3/images/generations}，路径里根本没有 {@code /v1} 这一段。
     *
     * <p>所以这里认两件事：
     * <ul>
     *   <li>base 末尾已经是版本段（{@code /v1}、{@code /v3}、{@code /api/v3}…）→ 不再补 {@code /v1}；</li>
     *   <li>base 末尾已经是这条资源路径本身 → 不重复追加（运营把文档上的完整接口地址整条粘进来）。</li>
     * </ul>
     * 两条都不命中就按原样拼，agnes 这类「base 是主机根」的配置行为不变。
     */
    static String joinUrl(String base, String path) {
        String b = rstrip(base);
        if (b.isEmpty() || path == null || path.isEmpty()) return b + (path == null ? "" : path);

        // /v1/images/generations → /images/generations
        String tail = path.startsWith("/v1/") ? path.substring(3) : path;
        if (b.endsWith(tail)) return b;               // 整条路径已经在 base 里
        if (endsWithVersionSegment(b)) return b + tail; // base 自带版本段，别再补 /v1
        return b + path;
    }

    /** base 的最后一段是不是 {@code v1} / {@code v2} / {@code v3}… 这种版本号。 */
    private static boolean endsWithVersionSegment(String base) {
        int slash = base.lastIndexOf('/');
        if (slash < 0 || slash == base.length() - 1) return false;
        String last = base.substring(slash + 1);
        if (last.length() < 2 || (last.charAt(0) != 'v' && last.charAt(0) != 'V')) return false;
        for (int i = 1; i < last.length(); i++) {
            if (!Character.isDigit(last.charAt(i))) return false;
        }
        return true;
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

    private static long secondsForFrames(int frames, int frameRate) {
        int fps = Math.max(1, frameRate);
        return Math.max(1L, (long) Math.ceil(Math.max(1, frames) / (double) fps));
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
