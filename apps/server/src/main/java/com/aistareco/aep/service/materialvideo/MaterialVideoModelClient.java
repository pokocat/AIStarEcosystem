package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

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

    private final AiModelInvocationService invocation;
    private final MaterialVideoProperties props;
    private final HttpClient http;

    public MaterialVideoModelClient(AiModelInvocationService invocation, MaterialVideoProperties props) {
        this.invocation = invocation;
        this.props = props;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    /** 是否已配置可用的视频生成端点（用途 VIDEO_GENERATION 已绑定 + 有 apiKey）。 */
    public boolean isConfigured() {
        AiModelEndpoint p = pickEndpoint();
        return p != null && decryptKey(p) != null;
    }

    /** 失败快：未绑定端点 / 无 apiKey 时抛 VIDEO_NOT_CONFIGURED（带明确提示）。 */
    public void ensureConfigured() {
        requireKey(requireEndpoint());
    }

    /** 提交一个生成任务，返回外部 task_id + 实际用到的端点 / model。 */
    public SubmitResult submit(String prompt, int durationSec, String aspectRatio) {
        AiModelEndpoint p = requireEndpoint();
        String apiKey = requireKey(p);
        String model = (p.getModel() != null && !p.getModel().isBlank())
                ? p.getModel() : props.getDefaultModel();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("prompt", prompt == null ? "" : prompt);
        // 多数厂商忽略不认识的字段；带上以便支持的厂商生效。
        if (durationSec > 0) body.put("duration", durationSec);
        if (aspectRatio != null && !aspectRatio.isBlank()) {
            body.put("aspect_ratio", aspectRatio);
            body.put("size", aspectRatio);
        }

        URI uri = URI.create(rstrip(p.getBaseUrl(), "/") + props.getSubmitPath());
        long startNanos = System.nanoTime();
        log.info("[material-video] submit start endpoint={} model={} durationSec={} aspectRatio={} promptLength={}",
                p.getName(), model, durationSec, aspectRatio, prompt == null ? 0 : prompt.length());
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("[material-video] submit http-error endpoint={} model={} status={} durationMs={} body={}",
                        p.getName(), model, resp.statusCode(), elapsedMs(startNanos), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频生成失败，请稍后重试",
                        "endpoint=" + p.getName() + " model=" + model + " status=" + resp.statusCode()
                                + " body=" + snippet(resp.body()));
            }
            JsonNode root = OM.readTree(resp.body());
            String taskId = firstText(root, "id", "task_id", "request_id", "taskId");
            if (taskId == null) {
                JsonNode data = root.get("data");
                if (data != null) taskId = firstText(data, "id", "task_id", "request_id", "taskId");
            }
            if (taskId == null || taskId.isBlank()) {
                log.warn("[material-video] submit missing-task-id endpoint={} model={} durationMs={} body={}",
                        p.getName(), model, elapsedMs(startNanos), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频生成失败，请稍后重试",
                        "missing task id; endpoint=" + p.getName() + " body=" + snippet(resp.body()));
            }
            log.info("[material-video] submit ok endpoint={} model={} taskId={} durationMs={}",
                    p.getName(), model, taskId, elapsedMs(startNanos));
            return new SubmitResult(taskId, p.getName(), model);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.warn("[material-video] submit exception endpoint={} model={} durationMs={} err={}",
                    p.getName(), model, elapsedMs(startNanos), e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成失败，请稍后重试",
                    "endpoint=" + p.getName() + " err=" + e);
        }
    }

    /** 轮询一个任务的状态。失败抛 BusinessException（含 HTTP 详情）。 */
    public PollResult poll(String taskId) {
        AiModelEndpoint p = requireEndpoint();
        String apiKey = requireKey(p);
        String path = props.getPollPathTemplate().replace("{id}", taskId);
        URI uri = URI.create(rstrip(p.getBaseUrl(), "/") + path);
        long startNanos = System.nanoTime();
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                log.warn("[material-video] poll http-error endpoint={} taskId={} status={} durationMs={} body={}",
                        p.getName(), taskId, resp.statusCode(), elapsedMs(startNanos), snippet(resp.body()));
                throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                        "视频生成失败，请稍后重试",
                        "poll; endpoint=" + p.getName() + " taskId=" + taskId + " status=" + resp.statusCode()
                                + " body=" + snippet(resp.body()));
            }
            JsonNode root = OM.readTree(resp.body());
            String rawStatus = firstText(root, "task_status", "status", "state");
            if (rawStatus == null) {
                JsonNode data = root.get("data");
                if (data != null) rawStatus = firstText(data, "task_status", "status", "state");
            }
            String status = normalizeStatus(rawStatus);
            String videoUrl = extractVideoUrl(root);
            String thumb = extractThumb(root);
            if (!"processing".equals(status)) {
                log.info("[material-video] poll terminal endpoint={} taskId={} status={} rawStatus={} hasVideo={} durationMs={}",
                        p.getName(), taskId, status, rawStatus, videoUrl != null && !videoUrl.isBlank(), elapsedMs(startNanos));
            }
            return new PollResult(status, videoUrl, thumb, rawStatus);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.warn("[material-video] poll exception endpoint={} taskId={} durationMs={} err={}",
                    p.getName(), taskId, elapsedMs(startNanos), e.toString());
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频生成失败，请稍后重试",
                    "poll; endpoint=" + p.getName() + " taskId=" + taskId + " err=" + e);
        }
    }

    // ── 端点选取（v0.41：用途 VIDEO_GENERATION → ai_app_binding → 端点） ─────────────

    private AiModelEndpoint pickEndpoint() {
        return invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)
                .filter(p -> p.getBaseUrl() != null && !p.getBaseUrl().isBlank())
                .orElse(null);
    }

    private AiModelEndpoint requireEndpoint() {
        AiModelEndpoint p = pickEndpoint();
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

    /** 常见成片 URL 位置：video_result[0].url / data.video_url / output.video_url / videos[0].url / video_url / url。 */
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
        String direct = firstText(root, "video_url", "videoUrl", "url", "download_url");
        if (direct != null) return direct;
        JsonNode data = root.get("data");
        if (data != null) {
            String d = firstText(data, "video_url", "videoUrl", "url", "download_url");
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

    private static String rstrip(String s, String suffix) {
        if (s == null) return "";
        return s.endsWith(suffix) ? s.substring(0, s.length() - suffix.length()) : s;
    }

    private static String snippet(String body) {
        if (body == null) return "";
        return body.length() > 300 ? body.substring(0, 300) + "…" : body;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    // ── 结果记录 ────────────────────────────────────────────────────────────────

    public record SubmitResult(String taskId, String providerUsed, String modelUsed) {}

    public record PollResult(String status, String videoUrl, String thumbnailUrl, String rawStatus) {
        public boolean succeeded() { return "succeeded".equals(status); }
        public boolean failed() { return "failed".equals(status); }
    }
}
