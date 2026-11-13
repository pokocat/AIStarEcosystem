package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.music.VolcOpenApiSigner;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;

/** Official Ark control plane. No bearer tokens, signed URLs or H5 credentials in logs. */
@Component
public class ArkAssetClient {
    static final String RATE_LIMITED = "VIDEO_ASSET_PROVIDER_RATE_LIMITED";
    static final String SUBMISSION_UNKNOWN = "VIDEO_ASSET_SUBMISSION_UNKNOWN";
    static final String NOT_FOUND = "VIDEO_ASSET_REMOTE_NOT_FOUND";
    private static final String OFFICIAL_ERROR = "arkError";
    private static final Logger log = LoggerFactory.getLogger(ArkAssetClient.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private final HttpClient http;
    public ArkAssetClient() { this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build()); }
    ArkAssetClient(HttpClient http) { this.http = http; }

    public JsonNode call(VideoAssetLibraryRecord library, String action, Map<String, Object> values) {
        try {
            JsonNode config = JSON.readTree(library.getConfigJson());
            String project = config.path("projectName").asText();
            String credential = AepCryptoUtil.decrypt(library.getCredentialEncrypted());
            if (project.isBlank() || credential == null || !credential.contains(":")) throw new IllegalArgumentException();
            String[] keys = credential.split(":", 2);
            Map<String,Object> body = new LinkedHashMap<>(values); body.put("ProjectName", project);
            String raw = JSON.writeValueAsString(body);
            URI uri = URI.create("https://ark.cn-beijing.volcengineapi.com/?Action=" + action + "&Version=2024-01-01");
            var signed = VolcOpenApiSigner.signPostJson(uri, raw, keys[0], keys[1], "cn-beijing", "ark", Instant.now());
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30));
            signed.headers().forEach((k,v) -> { if (!k.equalsIgnoreCase("host")) request.header(k,v); });
            var response = http.send(request.POST(HttpRequest.BodyPublishers.ofString(raw)).build(), HttpResponse.BodyHandlers.ofString());
            JsonNode root;
            try { root = JSON.readTree(response.body()); } catch (Exception invalid) { root = JSON.createObjectNode(); }
            if (root == null) root = JSON.createObjectNode();
            JsonNode metadata = root.path("ResponseMetadata");
            JsonNode result = root.path("Result");
            JsonNode error = metadata.hasNonNull("Error") ? metadata.path("Error") : result.path("Error");
            boolean assetStatus = "GetAsset".equals(action) && result.hasNonNull("Status") && !metadata.hasNonNull("Error");
            if (response.statusCode() / 100 != 2 || (!assetStatus && !error.isMissingNode() && !error.isNull())) {
                // Retain provider diagnostics, recursively removing credentials and URLs before writing them.
                String[] secrets = {keys[0], keys[1], Objects.toString(values.get("BytedToken"), "")};
                String bodyForLog = safe(root, secrets);
                log.warn("[ark-assets] action={} library={} status={} body={}", action, library.getId(), response.statusCode(), bodyForLog);
                String lower = error.path("Code").asText().toLowerCase(Locale.ROOT);
                String official = officialError(error, secrets);
                if (official == null) official = "【火山引擎】HTTP " + response.statusCode();
                var details = Map.of(OFFICIAL_ERROR, official);
                String diagnostic = "action=" + action + " status=" + response.statusCode() + " body=" + bodyForLog;
                if (response.statusCode() == 429 || lower.contains("flowlimit") || lower.contains("ratelimit")
                        || lower.contains("requestlimit") || lower.contains("throttl") || "toomanyrequests".equals(lower))
                    throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, RATE_LIMITED, official, details, diagnostic);
                if ("CreateAsset".equals(action) && response.statusCode() >= 500)
                    throw new BusinessException(HttpStatus.BAD_GATEWAY, SUBMISSION_UNKNOWN, official, details, diagnostic);
                boolean missing = lower.contains("notfound");
                throw new BusinessException(missing ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY,
                        missing ? NOT_FOUND : "VIDEO_ASSET_PROVIDER_FAILED", official, details, diagnostic);
            }
            return result;
        } catch (BusinessException ex) { throw ex; }
        catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw unavailable(action, ex); }
        catch (Exception ex) { throw unavailable(action, ex); }
    }
    static String officialError(BusinessException error) {
        return error.getDetails() instanceof Map<?, ?> details && details.get(OFFICIAL_ERROR) instanceof String official
                ? official : null;
    }

    static String officialError(JsonNode error, String... credentials) {
        String code = redactErrorText(error.path("Code").asText(error.path("code").asText()), credentials);
        String message = redactErrorText(error.isTextual() ? error.asText()
                : error.path("Message").asText(error.path("message").asText()), credentials);
        if (code.isBlank() && message.isBlank()) return null;
        if (code.isBlank()) return "【火山引擎】" + message;
        return "【火山引擎】" + code + (message.isBlank() ? "" : " " + message);
    }

    static String[] assetCredentials(VideoAssetLibraryRecord record) {
        return AepCryptoUtil.decrypt(record.getCredentialEncrypted()).split(":", 2);
    }

    private static String redactErrorText(String text, String... credentials) {
        String safe = text;
        for (String credential : credentials) {
            if (!credential.isBlank()) safe = safe.replace(credential, "[已脱敏]");
        }
        return safe.replaceAll("(?i)https?://[^\\s\\\"'<>]+", "[链接已脱敏]")
                .replaceAll("(?i)Bearer\\s+[^\\s,;]+", "Bearer [已脱敏]")
                .replaceAll("(?i)\\bvvs-[A-Za-z0-9_-]+", "[已脱敏]")
                .replaceAll("(?i)((?:byted_?token|api[_-]?key|access[_-]?key(?:id)?|secret[_-]?access[_-]?key|signature|credential)\\s*[:=]\\s*)(?:\"[^\"]*\"|'[^']*'|[^\\s,;]+)", "$1[已脱敏]");
    }
    private BusinessException unavailable(String action, Exception error) {
        log.warn("[ark-assets] action={} transport/config failure={}", action, error.getClass().getSimpleName());
        return BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "CreateAsset".equals(action) ? SUBMISSION_UNKNOWN : "VIDEO_ASSET_PROVIDER_FAILED",
                "素材服务暂时无法完成处理，请稍后重试。", "action="+action+" cause="+error.getClass().getSimpleName());
    }
    static String safe(JsonNode node, String... credentials) {
        JsonNode copy = node.deepCopy();
        redact(copy, credentials);
        String diagnostic = copy.toString();
        return diagnostic.substring(0, Math.min(3000, diagnostic.length()));
    }
    private static void redact(JsonNode node, String[] credentials) {
        if (node instanceof ObjectNode object) {
            object.fields().forEachRemaining(field -> {
                String name = field.getKey();
                JsonNode value = field.getValue();
                if (name.matches("(?i).*(token|key|authorization|url|link|secret).*")) object.put(name, "[redacted]");
                else if (value.isTextual()) object.put(name, redactErrorText(value.asText(), credentials));
                else redact(value, credentials);
            });
        } else if (node instanceof ArrayNode array) {
            for (int i = 0; i < array.size(); i++) {
                var value = array.get(i);
                if (value.isTextual()) array.set(i, TextNode.valueOf(redactErrorText(value.asText(), credentials)));
                else redact(value, credentials);
            }
        }
    }
}
