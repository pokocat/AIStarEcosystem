package com.aistareco.aep.service;

import com.aistareco.aep.dto.LlmKeyValidationDto;
import com.aistareco.aep.dto.LlmUsageReportDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** server 内嵌的 OpenAI-compatible LLM API；一 token 只对应一个 AiModelEndpoint，不做多 provider fallback。 */
@Service
public class EmbeddedLlmProxyService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedLlmProxyService.class);
    private static final ObjectMapper OM = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();
    private static final int BODY_CAPTURE_LIMIT = 64_000;

    private final AiModelEndpointRepository endpointRepo;
    private final AiModelEndpointKeyService keyService;
    private final AiModelGuardService guard;

    public EmbeddedLlmProxyService(AiModelEndpointRepository endpointRepo,
                                   AiModelEndpointKeyService keyService,
                                   AiModelGuardService guard) {
        this.endpointRepo = endpointRepo;
        this.keyService = keyService;
        this.guard = guard;
    }

    public ResponseEntity<String> chat(Map<String, Object> body,
                                       String authorization,
                                       String requestId,
                                       String purpose,
                                       String appCode) {
        AuthenticatedEndpoint auth = authenticate(authorization);
        AiModelEndpoint endpoint = auth.endpoint();
        Map<String, Object> upstreamBody = normalizeBody(endpoint, body);
        String model = String.valueOf(upstreamBody.get("model"));
        long startNanos = System.nanoTime();
        String requestJson = toJson(upstreamBody);
        try {
            guard.checkBeforeCall(endpoint, guard.estimateOpenAiBodyTokens(upstreamBody));
            HttpRequest req = HttpRequest.newBuilder(upstreamUri(endpoint, "/chat/completions"))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted()))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            Usage usage = parseUsage(resp.body());
            boolean ok = resp.statusCode() >= 200 && resp.statusCode() < 300;
            report(auth.key(), endpoint, usage.upstreamId(), model, purpose, appCode, ok,
                    ok ? null : "HTTP_" + resp.statusCode(),
                    ok ? null : snippet(resp.body(), 512),
                    usage.promptTokens(), usage.completionTokens(), usage.totalTokens(),
                    requestId, elapsedMs(startNanos), requestJson, resp.body(), null);
            return ResponseEntity.status(resp.statusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(resp.body());
        } catch (BusinessException e) {
            report(auth.key(), endpoint, null, model, purpose, appCode, false,
                    e.getCode(), snippet(e.getMessage(), 512),
                    0, 0, 0, requestId, elapsedMs(startNanos), requestJson, null, null);
            return openAiError(e.getStatus(), e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.warn("[llm-api] non-stream proxy failed requestId={} endpoint={} model={} err={}",
                    requestId, endpoint.getId(), model, e.toString());
            report(auth.key(), endpoint, null, model, purpose, appCode, false,
                    e.getClass().getSimpleName(), snippet(e.getMessage(), 512),
                    0, 0, 0, requestId, elapsedMs(startNanos), requestJson, null, null);
            return openAiError(HttpStatus.BAD_GATEWAY, "upstream_error", "上游模型调用失败");
        }
    }

    public ResponseEntity<StreamingResponseBody> stream(Map<String, Object> body,
                                                        String authorization,
                                                        String requestId,
                                                        String purpose,
                                                        String appCode) {
        AuthenticatedEndpoint auth = authenticate(authorization);
        AiModelEndpoint endpoint = auth.endpoint();
        Map<String, Object> upstreamBody = normalizeBody(endpoint, body);
        upstreamBody.put("stream", true);
        String model = String.valueOf(upstreamBody.get("model"));
        long startNanos = System.nanoTime();
        String requestJson = toJson(upstreamBody);
        try {
            guard.checkBeforeCall(endpoint, guard.estimateOpenAiBodyTokens(upstreamBody));
            HttpRequest req = HttpRequest.newBuilder(upstreamUri(endpoint, "/chat/completions"))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + AepCryptoUtil.decrypt(endpoint.getUpstreamApiKeyEncrypted()))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.ACCEPT, MediaType.TEXT_EVENT_STREAM_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();
            HttpResponse<InputStream> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofInputStream());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                String bodyText = readAllLimited(resp.body());
                report(auth.key(), endpoint, null, model, purpose, appCode, false,
                        "HTTP_" + resp.statusCode(), snippet(bodyText, 512),
                        0, 0, 0, requestId, elapsedMs(startNanos), requestJson, bodyText, null);
                return ResponseEntity.status(resp.statusCode())
                        .contentType(MediaType.TEXT_EVENT_STREAM)
                        .body(out -> out.write(("data: " + toJson(Map.of(
                                "error", Map.of("code", "upstream_" + resp.statusCode(), "message", bodyText)
                        )) + "\n\n").getBytes()));
            }

            StreamingResponseBody responseBody = outputStream -> {
                ByteArrayOutputStream capture = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                try (InputStream in = resp.body()) {
                    while ((n = in.read(buf)) >= 0) {
                        outputStream.write(buf, 0, n);
                        outputStream.flush();
                        if (capture.size() < BODY_CAPTURE_LIMIT) {
                            capture.write(buf, 0, Math.min(n, BODY_CAPTURE_LIMIT - capture.size()));
                        }
                    }
                    String captured = capture.toString();
                    Usage usage = parseStreamUsage(captured);
                    report(auth.key(), endpoint, usage.upstreamId(), model, purpose, appCode, true,
                            null, null,
                            usage.promptTokens(), usage.completionTokens(), usage.totalTokens(),
                            requestId, elapsedMs(startNanos), requestJson, captured, null);
                } catch (Exception e) {
                    log.warn("[llm-api] stream proxy failed requestId={} endpoint={} model={} err={}",
                            requestId, endpoint.getId(), model, e.toString());
                    report(auth.key(), endpoint, null, model, purpose, appCode, false,
                            e.getClass().getSimpleName(), snippet(e.getMessage(), 512),
                            0, 0, 0, requestId, elapsedMs(startNanos), requestJson, capture.toString(), null);
                    throw e;
                }
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(responseBody);
        } catch (BusinessException e) {
            report(auth.key(), endpoint, null, model, purpose, appCode, false,
                    e.getCode(), snippet(e.getMessage(), 512),
                    0, 0, 0, requestId, elapsedMs(startNanos), requestJson, null, null);
            return ResponseEntity.status(e.getStatus())
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(out -> out.write(("data: " + toJson(Map.of(
                            "error", Map.of("code", e.getCode(), "message", e.getMessage())
                    )) + "\n\n").getBytes()));
        } catch (Exception e) {
            log.warn("[llm-api] stream setup failed requestId={} endpoint={} model={} err={}",
                    requestId, endpoint.getId(), model, e.toString());
            report(auth.key(), endpoint, null, model, purpose, appCode, false,
                    e.getClass().getSimpleName(), snippet(e.getMessage(), 512),
                    0, 0, 0, requestId, elapsedMs(startNanos), requestJson, null, null);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .contentType(MediaType.TEXT_EVENT_STREAM)
                    .body(out -> out.write("data: {\"error\":{\"code\":\"upstream_error\",\"message\":\"上游模型调用失败\"}}\n\n".getBytes()));
        }
    }

    public Map<String, Object> models() {
        List<Map<String, Object>> data = new ArrayList<>();
        for (AiModelEndpoint endpoint : endpointRepo.findAllByOrderByCreatedAtDesc()) {
            if (!endpoint.isEnabled() || endpoint.getModel() == null || endpoint.getModel().isBlank()) continue;
            Map<String, Object> model = new LinkedHashMap<>();
            model.put("id", firstNonBlank(endpoint.getModelAlias(), endpoint.getModel()));
            model.put("object", "model");
            model.put("owned_by", endpoint.getName());
            model.put("root", endpoint.getModel());
            data.add(model);
        }
        return Map.of("object", "list", "data", data);
    }

    private AuthenticatedEndpoint authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "LLM_TOKEN_REQUIRED", "缺少 Authorization: Bearer token");
        }
        String token = authorization.substring("Bearer ".length()).trim();
        LlmKeyValidationDto key = keyService.validate(token);
        if (!key.ok() || key.keyId() == null || key.keyId().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "LLM_TOKEN_INVALID", "Token 无效或已撤销");
        }
        AiModelEndpoint endpoint = endpointRepo.findById(key.keyId())
                .filter(AiModelEndpoint::isEnabled)
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "LLM_TOKEN_ENDPOINT_DISABLED",
                        "Token 对应端点不可用"));
        return new AuthenticatedEndpoint(key, endpoint);
    }

    private Map<String, Object> normalizeBody(AiModelEndpoint endpoint, Map<String, Object> body) {
        if (body == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LLM_BODY_REQUIRED", "缺少请求体");
        }
        Map<String, Object> out = new LinkedHashMap<>(body);
        if (endpoint.getModel() == null || endpoint.getModel().isBlank()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "LLM_ENDPOINT_MODEL_REQUIRED",
                    "Token 对应端点未配置固定模型");
        }
        Object requestedModel = out.get("model");
        String model = requestedModel == null ? null : String.valueOf(requestedModel).trim();
        if (model == null || model.isBlank() || model.equals(endpoint.getModelAlias())) {
            out.put("model", endpoint.getModel());
        } else if (!model.equals(endpoint.getModel())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LLM_MODEL_NOT_ALLOWED",
                    "该 Token 只能调用绑定端点的固定模型或别名");
        }
        if (!out.containsKey("temperature") && endpoint.getDefaultTemperature() != null) {
            out.put("temperature", endpoint.getDefaultTemperature());
        }
        if (!out.containsKey("max_tokens") && endpoint.getDefaultMaxTokens() != null && endpoint.getDefaultMaxTokens() > 0) {
            out.put("max_tokens", endpoint.getDefaultMaxTokens());
        }
        if (!out.containsKey("top_p") && endpoint.getDefaultTopP() != null) {
            out.put("top_p", endpoint.getDefaultTopP());
        }
        return out;
    }

    private URI upstreamUri(AiModelEndpoint endpoint, String path) {
        return URI.create(rstrip(endpoint.getBaseUrl(), "/") + path);
    }

    private void report(LlmKeyValidationDto key, AiModelEndpoint endpoint, String upstreamId, String model,
                        String purpose, String appCode, boolean success, String errorCode, String errorMessage,
                        long promptTokens, long completionTokens, long totalTokens,
                        String requestId, long latencyMs, String requestBodyJson, String responseBodyJson,
                        String replayOfRecordId) {
        try {
            keyService.reportUsage(new LlmUsageReportDto(
                    key.keyId(),
                    requestId,
                    upstreamId,
                    latencyMs,
                    model,
                    purpose,
                    key.userId(),
                    null,
                    firstNonBlank(appCode, "external-api"),
                    success,
                    errorCode,
                    errorMessage,
                    promptTokens,
                    completionTokens,
                    totalTokens,
                    requestBodyJson,
                    responseBodyJson,
                    replayOfRecordId
            ));
        } catch (Exception e) {
            log.warn("[llm-api] usage report failed endpoint={} requestId={}: {}",
                    endpoint.getId(), requestId, e.toString());
        }
    }

    private static Usage parseUsage(String body) {
        if (body == null || body.isBlank()) return Usage.empty();
        try {
            JsonNode root = OM.readTree(body);
            JsonNode usage = root.path("usage");
            long prompt = usage.path("prompt_tokens").asLong(0);
            long completion = usage.path("completion_tokens").asLong(0);
            long total = usage.path("total_tokens").asLong(prompt + completion);
            String upstreamId = root.path("id").asText(null);
            return new Usage(upstreamId, prompt, completion, total);
        } catch (Exception ignored) {
            return Usage.empty();
        }
    }

    private static Usage parseStreamUsage(String text) {
        if (text == null || text.isBlank()) return Usage.empty();
        Usage out = Usage.empty();
        for (String line : text.split("\\R")) {
            String s = line.strip();
            if (!s.startsWith("data:")) continue;
            String json = s.substring("data:".length()).strip();
            if (json.isBlank() || "[DONE]".equals(json)) continue;
            Usage next = parseUsage(json);
            out = out.merge(next);
        }
        return out;
    }

    private static String readAllLimited(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) >= 0 && out.size() < BODY_CAPTURE_LIMIT) {
            out.write(buf, 0, Math.min(n, BODY_CAPTURE_LIMIT - out.size()));
        }
        return out.toString();
    }

    private static ResponseEntity<String> openAiError(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(toJson(Map.of("error", Map.of("code", code, "message", message))));
    }

    private static String toJson(Object value) {
        try {
            return OM.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String rstrip(String s, String suffix) {
        return s.endsWith(suffix) ? s.substring(0, s.length() - suffix.length()) : s;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static String snippet(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first.trim();
        if (second != null && !second.isBlank()) return second.trim();
        return null;
    }

    private record AuthenticatedEndpoint(LlmKeyValidationDto key, AiModelEndpoint endpoint) {}

    private record Usage(String upstreamId, long promptTokens, long completionTokens, long totalTokens) {
        static Usage empty() {
            return new Usage(null, 0, 0, 0);
        }

        Usage merge(Usage next) {
            if (next == null) return this;
            return new Usage(
                    firstNonBlank(next.upstreamId(), upstreamId),
                    next.promptTokens() > 0 ? next.promptTokens() : promptTokens,
                    next.completionTokens() > 0 ? next.completionTokens() : completionTokens,
                    next.totalTokens() > 0 ? next.totalTokens() : totalTokens
            );
        }
    }
}
