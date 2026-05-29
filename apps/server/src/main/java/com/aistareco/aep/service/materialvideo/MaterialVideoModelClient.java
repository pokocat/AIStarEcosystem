package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelProviderRepository;
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
 * Provider（baseUrl / apiKey / model）取自后台「AI 模型」配置（用途 = VIDEO_GENERATION）；
 * 「怎么提交 / 怎么轮询」的协议细节取自 aep.material.video.*（见 MaterialVideoProperties）。
 *
 * 默认对齐「异步任务式」约定（提交返回 task_id，轮询拿 status + 成片 URL），与
 * 智谱 CogVideoX 一致：POST {baseUrl}/videos/generations → GET {baseUrl}/async-result/{id}。
 * 响应解析对常见字段做了多形态兜底，换厂商时一般只需改 baseUrl + submit/poll 子路径；
 * 若厂商 wire 差异大，替换本文件的 submit()/poll() 解析即可，不影响任务调度 / 积分 / 前端。
 *
 * 不静默兜底：未配置 provider / apiKey → 抛 VIDEO_NOT_CONFIGURED（503，明确提示去哪配）。
 */
@Service
public class MaterialVideoModelClient {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoModelClient.class);
    private static final ObjectMapper OM = new ObjectMapper();

    private final AiModelProviderRepository providerRepo;
    private final MaterialVideoProperties props;
    private final HttpClient http;

    public MaterialVideoModelClient(AiModelProviderRepository providerRepo, MaterialVideoProperties props) {
        this.providerRepo = providerRepo;
        this.props = props;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }

    /** 是否已配置可用的视频生成 provider（用途 VIDEO_GENERATION + 有 apiKey）。 */
    public boolean isConfigured() {
        AiModelProvider p = pickProvider();
        return p != null && decryptKey(p) != null;
    }

    /** 失败快：未配置 provider / apiKey 时抛 VIDEO_NOT_CONFIGURED（带明确提示）。 */
    public void ensureConfigured() {
        requireKey(requireProvider());
    }

    /** 提交一个生成任务，返回外部 task_id + 实际用到的 provider / model。 */
    public SubmitResult submit(String prompt, int durationSec, String aspectRatio) {
        AiModelProvider p = requireProvider();
        String apiKey = requireKey(p);
        String model = (p.getDefaultModel() != null && !p.getDefaultModel().isBlank())
                ? p.getDefaultModel() : props.getDefaultModel();

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
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频生成提交失败（provider " + p.getName() + "，HTTP " + resp.statusCode() + "）："
                                + snippet(resp.body()));
            }
            JsonNode root = OM.readTree(resp.body());
            String taskId = firstText(root, "id", "task_id", "request_id", "taskId");
            if (taskId == null) {
                JsonNode data = root.get("data");
                if (data != null) taskId = firstText(data, "id", "task_id", "request_id", "taskId");
            }
            if (taskId == null || taskId.isBlank()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                        "视频生成提交成功但未解析到任务 id（provider " + p.getName() + "）：" + snippet(resp.body()));
            }
            log.info("[material-video] submit ok provider={} model={} taskId={}", p.getName(), model, taskId);
            return new SubmitResult(taskId, p.getName(), model);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_SUBMIT_FAILED",
                    "视频生成提交异常（provider " + p.getName() + "）：" + e.getMessage());
        }
    }

    /** 轮询一个任务的状态。失败抛 BusinessException（含 HTTP 详情）。 */
    public PollResult poll(String taskId) {
        AiModelProvider p = requireProvider();
        String apiKey = requireKey(p);
        String path = props.getPollPathTemplate().replace("{id}", taskId);
        URI uri = URI.create(rstrip(p.getBaseUrl(), "/") + path);
        try {
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(props.getHttpTimeoutSeconds()))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                        "视频任务轮询失败（HTTP " + resp.statusCode() + "）：" + snippet(resp.body()));
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
            return new PollResult(status, videoUrl, thumb, rawStatus);
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "VIDEO_POLL_FAILED",
                    "视频任务轮询异常：" + e.getMessage());
        }
    }

    // ── provider 选取 ──────────────────────────────────────────────────────────

    private AiModelProvider pickProvider() {
        String wire = AiModelPurpose.VIDEO_GENERATION.wire();
        return providerRepo.findByEnabledTrueOrderByPriorityAsc().stream()
                .filter(p -> p.getPurposes() != null && p.getPurposes().contains(wire))
                .filter(p -> p.getBaseUrl() != null && !p.getBaseUrl().isBlank())
                .findFirst()
                .orElse(null);
    }

    private AiModelProvider requireProvider() {
        AiModelProvider p = pickProvider();
        if (p == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                    "未配置「视频生成」用途的大模型服务商。请到 管理后台 → 平台与配置 → AI 模型，"
                            + "添加服务商并勾选「视频生成」用途（填好 baseUrl 与有效 API Key）。");
        }
        return p;
    }

    private String decryptKey(AiModelProvider p) {
        try {
            String k = AepCryptoUtil.decrypt(p.getApiKeyEncrypted());
            return (k == null || k.isBlank()) ? null : k;
        } catch (Exception e) {
            return null;
        }
    }

    private String requireKey(AiModelProvider p) {
        String k = decryptKey(p);
        if (k == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                    "视频生成服务商「" + p.getName() + "」未配置有效 API Key（请到 AI 模型页补全）。");
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

    // ── 结果记录 ────────────────────────────────────────────────────────────────

    public record SubmitResult(String taskId, String providerUsed, String modelUsed) {}

    public record PollResult(String status, String videoUrl, String thumbnailUrl, String rawStatus) {
        public boolean succeeded() { return "succeeded".equals(status); }
        public boolean failed() { return "failed".equals(status); }
    }
}
