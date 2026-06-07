package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
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
import java.util.Map;

/**
 * Agnes AI（apihub.agnes-ai.com）多模态客户端 —— 数字人资产平台唯一外部大模型出口。
 *
 * 协议（references：agnes-ai.com/doc/*）：
 *   · 文本   POST /v1/chat/completions   OpenAI 兼容（model=agnes-2.0-flash）
 *   · 图片   POST /v1/images/generations OpenAI Images 兼容（model=agnes-image-2.1-flash，
 *            i2i 走 extra_body.image=[url|dataURI]，extra_body.response_format=url）
 *   · 视频   POST /v1/videos（异步）+ GET /v1/videos/{taskId}
 *            （model=agnes-video-v2.0，status: queued|in_progress|completed|failed）
 *
 * 未配置 api-key 时 isConfigured()=false，调用方自行降级（占位产物 + mock 标记）。
 */
@Service
public class AgnesClient {

    private static final Logger log = LoggerFactory.getLogger(AgnesClient.class);
    private static final ObjectMapper OM = new ObjectMapper();

    private final DapProperties props;
    private final HttpClient http;

    public AgnesClient(DapProperties props) {
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public boolean isConfigured() {
        String key = props.getAgnes().getApiKey();
        return key != null && !key.isBlank();
    }

    public String imageModel() { return props.getAgnes().getImageModel(); }
    public String videoModel() { return props.getAgnes().getVideoModel(); }
    public String chatModel()  { return props.getAgnes().getChatModel(); }

    // ── 文本 ───────────────────────────────────────────────────

    /** 单轮 chat；返回 assistant content。 */
    public String chat(String systemPrompt, String userPrompt) {
        ObjectNode body = OM.createObjectNode();
        body.put("model", props.getAgnes().getChatModel());
        ArrayNode messages = body.putArray("messages");
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.addObject().put("role", "system").put("content", systemPrompt);
        }
        messages.addObject().put("role", "user").put("content", userPrompt);
        body.put("temperature", 0.6);

        JsonNode resp = postJson("/v1/chat/completions", body);
        JsonNode content = resp.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) {
            throw new AgnesException("AGNES_BAD_OUTPUT", "chat 响应缺少 choices[0].message.content");
        }
        return content.asText();
    }

    /** chat 并解析 JSON 产物（剥 markdown 围栏 + 截取首个 {...}）。 */
    public JsonNode chatJson(String systemPrompt, String userPrompt) {
        String raw = chat(systemPrompt, userPrompt);
        String cleaned = extractJson(raw);
        try {
            return OM.readTree(cleaned);
        } catch (IOException e) {
            throw new AgnesException("AGNES_BAD_OUTPUT", "chat 输出不是合法 JSON: " + truncate(raw, 300));
        }
    }

    // ── 图片 ───────────────────────────────────────────────────

    /**
     * 生成 / 编辑图片，返回图片字节。
     *
     * @param prompt      英文 prompt（调用方负责翻译）
     * @param size        如 768x1024；null 用模型默认
     * @param inputImages i2i 输入（公网 URL 或 data:image/...;base64,xxx），空 = 文生图
     */
    public byte[] generateImage(String prompt, String size, List<String> inputImages) {
        ObjectNode body = OM.createObjectNode();
        body.put("model", props.getAgnes().getImageModel());
        body.put("prompt", prompt);
        if (size != null && !size.isBlank()) body.put("size", size);
        ObjectNode extra = body.putObject("extra_body");
        extra.put("response_format", "url");
        if (inputImages != null && !inputImages.isEmpty()) {
            ArrayNode arr = extra.putArray("image");
            inputImages.forEach(arr::add);
        }

        JsonNode resp = postJson("/v1/images/generations", body);
        JsonNode data0 = resp.path("data").path(0);
        String url = data0.path("url").asText(null);
        if (url != null && !url.isBlank()) {
            return download(url, 64 * 1024 * 1024);
        }
        String b64 = data0.path("b64_json").asText(null);
        if (b64 != null && !b64.isBlank()) {
            return Base64.getDecoder().decode(b64);
        }
        throw new AgnesException("AGNES_BAD_OUTPUT", "images 响应缺少 data[0].url / b64_json: " + truncate(resp.toString(), 300));
    }

    // ── 视频（异步）────────────────────────────────────────────

    public record VideoTask(String taskId, String status, String videoUrl, String raw) {}

    /**
     * 创建视频任务。
     *
     * @param prompt     英文 prompt
     * @param inputImage i2v 输入（URL / dataURI），null = 文生视频
     */
    public String createVideoTask(String prompt, String inputImage, int width, int height,
                                  int numFrames, int frameRate) {
        ObjectNode body = OM.createObjectNode();
        body.put("model", props.getAgnes().getVideoModel());
        body.put("prompt", prompt);
        body.put("width", width);
        body.put("height", height);
        body.put("num_frames", normalizeFrames(numFrames));
        body.put("frame_rate", frameRate);
        if (inputImage != null && !inputImage.isBlank()) {
            body.put("image", inputImage);
        }
        JsonNode resp = postJson("/v1/videos", body);
        String taskId = firstNonBlank(
                resp.path("id").asText(null),
                resp.path("task_id").asText(null),
                resp.path("data").path("id").asText(null),
                resp.path("data").path("task_id").asText(null));
        if (taskId == null) {
            throw new AgnesException("AGNES_BAD_OUTPUT", "videos 响应缺少任务 id: " + truncate(resp.toString(), 300));
        }
        log.info("[agnes] video-task created taskId={} model={} size={}x{} frames={} fps={}",
                taskId, props.getAgnes().getVideoModel(), width, height, normalizeFrames(numFrames), frameRate);
        return taskId;
    }

    /** 查询视频任务（status 归一化为 queued|in_progress|completed|failed）。 */
    public VideoTask getVideoTask(String taskId) {
        JsonNode resp = getJson("/v1/videos/" + taskId);
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
        return new VideoTask(taskId, status, videoUrl, resp.toString());
    }

    /** 阻塞轮询直到 completed/failed/超时；progress 回调收 [0,1] 估算值。 */
    public VideoTask awaitVideo(String taskId, java.util.function.DoubleConsumer progress) {
        int interval = Math.max(2, props.getAgnes().getVideoPollIntervalSeconds());
        int maxWait = Math.max(30, props.getAgnes().getVideoMaxWaitSeconds());
        long deadline = System.currentTimeMillis() + maxWait * 1000L;
        long start = System.currentTimeMillis();
        String lastStatus = null;
        long lastHeartbeat = 0L;
        while (System.currentTimeMillis() < deadline) {
            VideoTask t = getVideoTask(taskId);
            long now = System.currentTimeMillis();
            if (!t.status().equals(lastStatus) || now - lastHeartbeat >= 60_000L) {
                log.info("[agnes] video-task poll taskId={} status={} elapsedSec={} maxWaitSec={} videoUrlPresent={}",
                        taskId, t.status(), (now - start) / 1000L, maxWait, t.videoUrl() != null && !t.videoUrl().isBlank());
                lastStatus = t.status();
                lastHeartbeat = now;
            }
            if ("completed".equals(t.status()) || "failed".equals(t.status())) return t;
            if (progress != null) {
                double frac = Math.min(0.95, (System.currentTimeMillis() - start) / (double) (maxWait * 1000L) * 3.0);
                progress.accept(frac);
            }
            try {
                Thread.sleep(interval * 1000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new AgnesException("AGNES_INTERRUPTED", "视频轮询被中断");
            }
        }
        throw new AgnesException("AGNES_TIMEOUT", "视频生成超时（>" + maxWait + "s），任务 " + taskId);
    }

    // ── 通用 HTTP ──────────────────────────────────────────────

    public byte[] download(String url, long maxBytes) {
        long startNanos = System.nanoTime();
        log.info("[agnes] download start host={} maxBytes={}", hostOf(url), maxBytes);
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(Math.max(60, props.getAgnes().getHttpTimeoutSeconds())))
                    .GET().build();
            HttpResponse<byte[]> resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (resp.statusCode() >= 400) {
                log.warn("[agnes] download http-error host={} status={} durationMs={}",
                        hostOf(url), resp.statusCode(), elapsedMs(startNanos));
                throw new AgnesException("AGNES_DOWNLOAD_FAILED", "下载产物失败 HTTP " + resp.statusCode() + " " + url);
            }
            byte[] body = resp.body();
            if (body.length > maxBytes) {
                log.warn("[agnes] download too-large host={} bytes={} maxBytes={} durationMs={}",
                        hostOf(url), body.length, maxBytes, elapsedMs(startNanos));
                throw new AgnesException("AGNES_DOWNLOAD_TOO_LARGE", "产物超出大小上限: " + body.length + " bytes");
            }
            log.info("[agnes] download ok host={} status={} bytes={} durationMs={}",
                    hostOf(url), resp.statusCode(), body.length, elapsedMs(startNanos));
            return body;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("[agnes] download exception host={} durationMs={} err={}",
                    hostOf(url), elapsedMs(startNanos), e.toString());
            throw new AgnesException("AGNES_DOWNLOAD_FAILED", "下载产物失败: " + e.getMessage());
        }
    }

    private JsonNode postJson(String path, ObjectNode body) {
        ensureConfigured();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(props.getAgnes().getBaseUrl() + path))
                    .timeout(Duration.ofSeconds(props.getAgnes().getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + props.getAgnes().getApiKey())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                    .build();
            return sendForJson(req, path);
        } catch (IOException e) {
            throw new AgnesException("AGNES_CALL_FAILED", "请求体序列化失败: " + e.getMessage());
        }
    }

    private JsonNode getJson(String path) {
        ensureConfigured();
        HttpRequest req = HttpRequest.newBuilder(URI.create(props.getAgnes().getBaseUrl() + path))
                .timeout(Duration.ofSeconds(props.getAgnes().getHttpTimeoutSeconds()))
                .header("Authorization", "Bearer " + props.getAgnes().getApiKey())
                .GET().build();
        return sendForJson(req, path);
    }

    private JsonNode sendForJson(HttpRequest req, String path) {
        long startNanos = System.nanoTime();
        log.info("[agnes] call start method={} path={} operation={} host={}",
                req.method(), path, operationFromPath(req), req.uri().getHost());
        try {
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() >= 400) {
                log.warn("[agnes] call http-error method={} path={} operation={} status={} durationMs={} body={}",
                        req.method(), path, operationFromPath(req), resp.statusCode(), elapsedMs(startNanos), truncate(resp.body(), 400));
                throw new AgnesException("AGNES_HTTP_" + resp.statusCode(),
                        "Agnes 调用失败 HTTP " + resp.statusCode() + "（" + path + "）: " + truncate(resp.body(), 200));
            }
            log.info("[agnes] call ok method={} path={} operation={} status={} durationMs={} bytes={}",
                    req.method(), path, operationFromPath(req), resp.statusCode(), elapsedMs(startNanos),
                    resp.body() == null ? 0 : resp.body().length());
            return OM.readTree(resp.body());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("[agnes] call exception method={} path={} operation={} durationMs={} err={}",
                    req.method(), path, operationFromPath(req), elapsedMs(startNanos), e.toString());
            throw new AgnesException("AGNES_CALL_FAILED", "Agnes 网络调用失败（" + path + "）: " + e.getMessage());
        }
    }

    private void ensureConfigured() {
        if (!isConfigured()) {
            throw new AgnesException("AGNES_NOT_CONFIGURED", "未配置 AGNES_API_KEY，无法调用生成引擎");
        }
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
        return null;
    }

    /** Agnes 调用异常（runner 捕获后落 job.errorMessage + 释放冻结积分）。 */
    public static class AgnesException extends RuntimeException {
        private final String code;
        public AgnesException(String code, String message) {
            super(message);
            this.code = code;
        }
        public String getCode() { return code; }
    }
}
