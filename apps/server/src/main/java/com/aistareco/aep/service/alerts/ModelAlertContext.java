package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.aistareco.aep.service.ai.ProviderResponseDiagnostics;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.Map;
import java.util.Set;

/** Read original task checkpoints, never guess a call by user/time or read another task's usage. */
@Service
public class ModelAlertContext {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> PARAMS = Set.of("model", "size", "width", "height", "n", "count", "seed", "steps",
            "num_inference_steps", "guidance_scale", "cfg_scale", "strength", "duration", "duration_sec", "duration_seconds",
            "seconds", "aspect_ratio", "aspectRatio", "orientation", "resolution", "resolution_tier", "resolutionTier",
            "generation_mode", "generationMode", "outputSizeCode", "output_size", "fps", "quality", "format", "output_format",
            "response_format", "sample_rate", "speed", "pitch", "volume", "speaker", "language", "temperature", "top_p",
            "max_tokens", "stream", "optimize_prompt", "optimizePrompt", "watermark", "enable_audio", "audio", "return_last_frame");
    private final JdbcTemplate db;

    public ModelAlertContext(JdbcTemplate db) { this.db = db; }

    /** Diagnostic enrichment is best effort; it cannot prevent a failure/refund or the original alert. */
    public String describe(String taskId) {
        try { return resolve(taskId, false); }
        catch (Exception unavailable) { return "模型信息：暂时无法读取，请按任务号查看后台原始记录"; }
    }

    /** Compact bot context: omit empty fields and request summaries, retaining the route needed to diagnose the response. */
    public String describeForAlert(String taskId) {
        try { return resolve(taskId, true); }
        catch (Exception unavailable) { return ""; }
    }

    private String resolve(String taskId, boolean compact) {
        String endpointId = "", name = "", model = "", base = "", paramsSource = "任务参数（非完整上游请求）";
        String remoteTask = "";
        JsonNode params = JSON.createObjectNode();
        var videos = db.queryForList("SELECT provider_used,model_used,upstream_base_url_snapshot,variant_config_json,duration_sec,aspect_ratio,external_task_id FROM material_video_job WHERE id=?", taskId);
        if (!videos.isEmpty()) {
            var video = videos.get(0);
            name = value(video, "provider_used"); model = value(video, "model_used"); base = value(video, "upstream_base_url_snapshot");
            remoteTask = value(video, "external_task_id");
            var variant = parse(value(video, "variant_config_json")); endpointId = variant.path("endpoint_id").asText("");
            ObjectNode selected = variant.isObject() ? ((ObjectNode) variant).deepCopy() : JSON.createObjectNode();
            selected.put("duration_sec", ((Number) video.get("duration_sec")).intValue());
            selected.put("aspect_ratio", value(video, "aspect_ratio")); params = selected;
        } else {
            var runs = db.queryForList("SELECT kind,input_json,output_json FROM ip_run WHERE id=?", taskId);
            if (!runs.isEmpty()) {
                var run = runs.get(0); var input = parse(value(run, "input_json")); var exec = input.path("_exec");
                endpointId = exec.path("endpointId").asText("");
                int completed = parse(value(run, "output_json")).path("candidates").size();
                var checkpoint = exec.path("imageJobs").path(completed);
                if (!checkpoint.isObject()) checkpoint = exec;
                remoteTask = checkpoint.path("jobId").asText("");
                base = checkpoint.path("baseUrl").asText("");
                model = checkpoint.path("model").asText("");
                String body = checkpoint.path("requestBody").asText("");
                if (!body.isBlank()) {
                    params = parse(body); paramsSource = "提交参数（原请求快照，已脱敏）";
                    model = first(model, params.path("model").asText(""));
                } else params = input;
            }
        }
        if (endpointId.isBlank()) {
            var tickets = db.queryForList("SELECT endpoint_id FROM ai_generation_queue WHERE task_id=? ORDER BY id DESC LIMIT 1", taskId);
            if (!tickets.isEmpty()) endpointId = value(tickets.get(0), "endpoint_id");
        }
        String baseSource = "任务快照", modelSource = "任务快照";
        if (!endpointId.isBlank()) {
            // AiModelEndpoint.model deliberately retains the legacy physical column default_model.
            var endpoints = db.queryForList("SELECT name,default_model AS model,base_url FROM ai_model_providers WHERE id=?", endpointId);
            if (!endpoints.isEmpty()) {
                var endpoint = endpoints.get(0); name = first(name, value(endpoint, "name"));
                if (model.isBlank()) { model = value(endpoint, "model"); modelSource = "当前端点配置，原调用未记录"; }
                if (base.isBlank()) { base = value(endpoint, "base_url"); baseSource = "当前端点配置，原调用未记录"; }
            }
        }
        if (compact) {
            var lines = new java.util.ArrayList<String>();
            if (ProviderResponseDiagnostics.safeId(remoteTask) != null) lines.add("远端任务 ID：" + remoteTask);
            if (!name.isBlank() || !endpointId.isBlank()) lines.add("供应商 / 端点：" +
                    (name.isBlank() ? label(endpointId) : label(name) + (endpointId.isBlank() ? "" : "（" + label(endpointId) + "）")));
            if (!model.isBlank()) lines.add("模型：" + label(model) + (modelSource.startsWith("当前") ? "（当前配置）" : ""));
            return String.join("\n", lines);
        }
        return "远端任务 ID：" + (ProviderResponseDiagnostics.safeId(remoteTask) == null ? "未获取" : remoteTask)
                + "\n供应商 / 端点：" + label(name) + "（" + label(endpointId) + "）"
                + "\nAPI 基础地址：" + safeUrl(base) + "（" + baseSource + "）"
                + "\n模型：" + label(model) + "（" + modelSource + "）"
                + "\n" + paramsSource + "：" + parameters(params)
                + "\n完整参数 / 原始响应：后台 → 请求日志；提示词和素材内容不发送到群。";
    }

    static String parameters(JsonNode input) {
        ObjectNode output = JSON.createObjectNode();
        if (input.isObject()) input.fields().forEachRemaining(field -> {
            String key = field.getKey(); JsonNode value = field.getValue();
            if (PARAMS.contains(key) && value.isValueNode() && !value.isNull()) {
                if (value.isNumber() || value.isBoolean()) output.set(key, value);
                else {
                    String text = value.asText();
                    // Only bounded scalar model settings; URLs, credentials and free text never cross this boundary.
                    if (text.length() <= 100 && text.matches("[\\p{L}\\p{N}_. /:+-]+") && !text.contains("://")
                            && !text.matches("(?i).*(?:bearer |sk-|jsk_|ark-|token[=:]).*")) output.put(key, text);
                    else output.put(key, "[已脱敏]");
                }
            } else if (Set.of("prompt", "negative_prompt", "text").contains(key) && value.isTextual()) {
                output.put(key + "_chars", value.asText().length());
            } else if (key.matches("(?i).*(?:reference|images|refs|frame|asset|input_image|input_audio|input_video).*")) {
                if (value.isArray()) output.put(key.replaceAll("[^A-Za-z0-9_]", "_") + "_count", value.size());
                else if (!value.isNull() && !value.asText().isBlank()) output.put(key.replaceAll("[^A-Za-z0-9_]", "_") + "_present", true);
            }
        });
        String text = output.toString();
        return output.isEmpty() ? "未记录可展示参数，请查看后台原始请求" : text.length() > 2200 ? text.substring(0, 2200) + "…（更多见后台）" : text;
    }

    static String safeUrl(String input) {
        try {
            URI uri = URI.create(input);
            if (!Set.of("https", "http").contains(uri.getScheme()) || uri.getHost() == null) return "未记录";
            return new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(), uri.getPath(), null, null).toString();
        } catch (Exception invalid) { return "未记录"; }
    }
    private static String label(String value) { return value == null || value.isBlank() ? "未记录" : value.replaceAll("[\\r\\n\\t]", " ").substring(0, Math.min(160, value.length())); }
    private static String first(String a, String b) { return a.isBlank() ? b : a; }
    private static String value(Map<String, Object> row, String field) { return row.get(field) == null ? "" : row.get(field).toString(); }
    private static JsonNode parse(String input) {
        try { JsonNode value = JSON.readTree(input); return value == null ? JSON.createObjectNode() : value; }
        catch (Exception invalid) { return JSON.createObjectNode(); }
    }
}
