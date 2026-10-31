package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.function.UnaryOperator;
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

    public static boolean hasError(JsonNode body) { return hasError(body, 0); }

    private static boolean hasError(JsonNode body, int depth) {
        if(body == null || !body.isObject() || depth > 5) return false;
        for(String field:List.of("error", "Error", "errors")) {
            JsonNode error=body.path(field);
            if(error.isTextual() && !error.asText().isBlank() || (error.isObject() || error.isArray()) && !error.isEmpty()) return true;
        }
        for(String field:List.of("data", "result", "ResponseMetadata", "responseMetadata", "response", "metadata"))
            if(hasError(body.path(field), depth + 1)) return true;
        return false;
    }

    public static String reason(String body) { return reason(body, ProviderErrorMessage::sanitize, true); }

    public static String reason(JsonNode body) {
        var moderation = ProviderContentModeration.find(body);
        return moderation == null ? read(body, 0, ProviderErrorMessage::sanitize) : moderation.message();
    }

    /**
     * Same lookup as {@link #reason}, but keeps the supplier's own wording (quota, balance…) for classification.
     * Classify on this, never on {@link #reason}: the public text has those words replaced by a generic sentence.
     * Do not return this value through a customer DTO or exception message.
     */
    public static String diagnosticReason(String body) { return reason(body, ProviderErrorMessage::diagnostic, false); }

    public static String diagnosticReason(JsonNode body) { return read(body, 0, ProviderErrorMessage::diagnostic); }

    private static String reason(String body, UnaryOperator<String> clean, boolean publicOutput) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode parsed = JSON.readTree(body);
            return publicOutput ? reason(parsed) : read(parsed, 0, clean);
        }
        catch (Exception invalid) {
            // Preserve the legacy truncated-JSON diagnostic path; never parse text/HTML gateway pages.
            if (!body.stripLeading().startsWith("{") || HTML.matcher(body).find()) return null;
            var match = MESSAGE.matcher(body);
            if (match.find()) try { return clean.apply(JSON.readValue("\"" + match.group(1) + "\"", String.class)); }
            catch (Exception ignored) { /* No complete readable message. */ }
            return null;
        }
    }

    private static String read(JsonNode node, int depth, UnaryOperator<String> clean) {
        if (node == null || depth > 5) return null;
        if (node.isArray()) {
            for (JsonNode item : node) {
                String reason = read(item, depth + 1, clean);
                if (reason != null) return reason;
            }
            return null;
        }
        if (!node.isObject()) return null;
        // A gateway's top-level "message: success/error" must not hide the concrete nested failure.
        String explicit = readError(node, depth, clean);
        if (explicit != null) return explicit;
        for (String key : List.of("message", "Message", "msg", "Msg", "error_message", "errorMessage",
                "fail_reason", "failReason", "reason", "detail", "error_description")) {
            JsonNode value = node.path(key);
            if (value.isTextual()) {
                String reason = clean.apply(value.asText());
                if (reason != null) return reason;
            }
        }
        for (String key : List.of("data", "result", "response", "metadata")) {
            String reason = read(node.path(key), depth + 1, clean);
            if (reason != null) return reason;
        }
        return null;
    }

    private static String readError(JsonNode node, int depth, UnaryOperator<String> clean) {
        if (node == null || !node.isObject() || depth > 5) return null;
        for (String key : List.of("error", "errors", "Error", "ResponseMetadata", "responseMetadata", "FailureReason")) {
            JsonNode error = node.path(key);
            String reason = error.isTextual() ? clean.apply(error.asText()) : read(error, depth + 1, clean);
            if (reason != null) return reason;
        }
        for (String key : List.of("data", "result", "response", "metadata")) {
            String reason = readError(node.path(key), depth + 1, clean);
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
