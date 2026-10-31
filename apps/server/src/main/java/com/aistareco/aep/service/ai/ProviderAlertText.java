package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Keep supplier diagnostics readable while removing credentials and binary media from group notifications. */
public final class ProviderAlertText {
    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final int LIMIT = 12_000;
    private static final Set<String> SECRET_FIELDS = Set.of("authorization", "apikey", "key", "accesstoken",
            "refreshtoken", "token", "secret", "secretkey", "clientsecret", "privatekey", "apisecret", "appsecret",
            "password", "credential", "credentials");
    private static final Pattern ASSIGNMENT = Pattern.compile(
            "(?i)([\\\"']?(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|(?:api|app)?[_-]?secret|password|prompt|negative_prompt)[\\\"']?\\s*[:=]\\s*)(?:\\\"[^\\\"]*\\\"|'[^']*'|[^\\s,;}]+)");
    private static final Pattern URL = Pattern.compile("https?://[^\\s\\\"'<>}]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern MEDIA_VALUE = Pattern.compile(
            "(?i)(\"(?:b64_json|base64|bytes)\"\\s*:\\s*\")[^\"]*");
    private ProviderAlertText() {}

    public static String sanitize(String input) {
        if (input == null || input.isBlank()) return "";
        String safe;
        try {
            JsonNode body = JSON.readTree(input);
            safe = body == null ? "" : redact(body).toString();
        } catch (Exception notJson) {
            // Oversized or truncated image JSON may fail before tree-based redaction runs.
            String withoutMedia=MEDIA_VALUE.matcher(input).replaceAll("$1[媒体数据已省略]");
            safe = ASSIGNMENT.matcher(withoutMedia.replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [已脱敏]")).replaceAll("$1[已脱敏]");
        }
        // Keys and signed asset links may also be embedded inside a supplier's free-text message.
        safe = safe.replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [已脱敏]")
                .replaceAll("(?i)(?<![A-Za-z0-9])(?:sk-|jsk_|ark-)[A-Za-z0-9_-]+", "[已脱敏]")
                .replaceAll("data:[^\\s\\\"]+;base64,[A-Za-z0-9+/=]+", "[媒体数据已省略]");
        var urls = URL.matcher(safe);
        var output = new StringBuffer();
        while (urls.find()) urls.appendReplacement(output, "[链接已脱敏]");
        urls.appendTail(output);
        safe = output.toString();
        if (safe.length() <= LIMIT) return safe;
        int end = Character.isHighSurrogate(safe.charAt(LIMIT - 1)) ? LIMIT - 1 : LIMIT;
        return safe.substring(0, end) + "\n…（响应过长，完整内容见后台请求日志）";
    }

    private static JsonNode redact(JsonNode node) {
        if (node.isObject()) {
            ObjectNode copy = ((ObjectNode) node).deepCopy();
            node.fields().forEachRemaining(field -> {
                String key = field.getKey().replaceAll("[_-]", "").toLowerCase(Locale.ROOT);
                if (SECRET_FIELDS.contains(key) || key.endsWith("apikey") || key.endsWith("accesstoken"))
                    copy.put(field.getKey(), "[已脱敏]");
                else if (Set.of("b64json", "base64", "bytes").contains(key)) copy.put(field.getKey(), "[媒体数据已省略]");
                else copy.set(field.getKey(), redact(field.getValue()));
            });
            return copy;
        }
        if (node.isArray()) {
            var copy = JSON.createArrayNode();
            node.forEach(value -> copy.add(redact(value)));
            return copy;
        }
        if (node.isTextual()) return com.fasterxml.jackson.databind.node.TextNode.valueOf(
                ASSIGNMENT.matcher(node.asText().replaceAll("(?i)Bearer\\s+[A-Za-z0-9._~+/=-]+", "Bearer [已脱敏]")).replaceAll("$1[已脱敏]"));
        return node;
    }
}
