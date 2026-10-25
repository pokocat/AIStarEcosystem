package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.regex.Pattern;

/** One public-message policy for model HTTP errors, stream errors and asynchronous job failures. */
public final class ProviderErrorMessage {
    private static final ObjectMapper JSON = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final Pattern MESSAGE = Pattern.compile("\"(?:message|Message|msg|Msg|error_description)\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
    private static final Pattern HTML = Pattern.compile("(?is)<[/!a-z][^>]*>");
    private ProviderErrorMessage() {}

    public static String message(String body, String fallback) {
        String reason = reason(body);
        return reason == null ? PublicModelErrorPolicy.stored(fallback, "AI_PROVIDER_ERROR") : reason;
    }

    public static String append(String body, String context) {
        String reason = reason(body);
        String combined = reason == null || context.contains(reason) ? context : context + "；" + reason;
        return PublicModelErrorPolicy.stored(combined, "AI_PROVIDER_ERROR");
    }

    public static boolean hasError(JsonNode body) {
        if(body == null || !body.isObject()) return false;
        JsonNode error=body.path("error");
        return error.isTextual() && !error.asText().isBlank() || error.isObject() && !error.isEmpty();
    }

    public static String reason(String body) {
        if (body == null || body.isBlank()) return null;
        try { return reason(JSON.readTree(body)); }
        catch (Exception invalid) {
            // Preserve the legacy truncated-JSON diagnostic path; never parse text/HTML gateway pages.
            if (!body.stripLeading().startsWith("{") || HTML.matcher(body).find()) return null;
            var match = MESSAGE.matcher(body);
            if (match.find()) try { return sanitize(JSON.readValue("\"" + match.group(1) + "\"", String.class)); }
            catch (Exception ignored) { /* No complete readable message. */ }
            return null;
        }
    }

    public static String reason(JsonNode body) { return read(body, 0); }

    private static String read(JsonNode node, int depth) {
        if (node == null || !node.isObject() || depth > 4) return null;
        for (String key : List.of("error", "Error", "ResponseMetadata", "responseMetadata")) {
            JsonNode error = node.path(key);
            String reason = error.isTextual() ? sanitize(error.asText()) : read(error, depth + 1);
            if (reason != null) return reason;
        }
        for (String key : List.of("message", "Message", "msg", "Msg", "error_message", "errorMessage",
                "fail_reason", "failReason", "reason", "detail", "error_description")) {
            JsonNode value = node.path(key);
            if (value.isTextual()) {
                String reason = sanitize(value.asText());
                if (reason != null) return reason;
            }
        }
        for (String key : List.of("data", "result", "ResponseMetadata", "responseMetadata", "response", "metadata")) {
            String reason = read(node.path(key), depth + 1);
            if (reason != null) return reason;
        }
        return null;
    }

    public static String sanitize(String text) {
        String safe = PublicModelErrorPolicy.upstream(diagnostic(text));
        return safe == null || safe.isBlank() ? null : safe;
    }

    /** Internal classification only; do not return this value through a customer DTO or exception message. */
    public static String diagnostic(String text) {
        if (text == null || text.isBlank() || HTML.matcher(text).find()) return null;
        String safe;
        try {
            String bounded=text.codePointCount(0,text.length())<=4000?text:text.substring(0,text.offsetByCodePoints(0,4000));
            var wrapped = JSON.createObjectNode().put("message", bounded);
            safe = JSON.readTree(ProviderAlertText.sanitize(wrapped.toString())).path("message").asText();
        } catch (Exception ignored) { return null; }
        safe = safe.replaceAll("[\\p{Cntrl}\\s]+", " ").strip()
                .replaceAll("(?i)(\\b(?:key|signature|credential|secret)\\s*[:=]\\s*)[^\\s,;]+", "$1[已脱敏]")
                .replaceAll("[A-Za-z0-9_-]{32,}", "[已脱敏]");
        if (safe.isBlank()) return null;
        return safe.codePointCount(0, safe.length()) <= 200 ? safe : safe.substring(0, safe.offsetByCodePoints(0, 200)) + "…";
    }
}
