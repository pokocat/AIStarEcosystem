package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.http.HttpResponse;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Safe response evidence attached to the original exception, without changing its type or public message. */
public final class ProviderResponseDiagnostics extends RuntimeException {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final List<String> HEADERS = List.of("x-tt-logid", "x-log-id", "x-logid", "logid", "log-id",
            "x-request-id", "request-id", "x-requestid", "x-bce-request-id", "x-amzn-requestid", "x-trace-id");
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}");
    private static final Pattern LEGACY_ID = Pattern.compile(
            "(?i)(?<![A-Za-z0-9_-])((?:x-tt-|x-bce-|x-amzn-|x-)?(?:request[_ -]?id|log[_ -]?id|trace[_ -]?id))[\\\"' :=]+([A-Za-z0-9][A-Za-z0-9_.:-]{0,255})(?![A-Za-z0-9_.:-])");
    private final int status;
    private final Set<String> identifiers;

    private ProviderResponseDiagnostics(int status, Set<String> identifiers) {
        super("upstream HTTP " + status + " " + String.join("; ", identifiers), null, false, false);
        this.status = status;
        this.identifiers = java.util.Collections.unmodifiableSet(new LinkedHashSet<>(identifiers));
    }

    public int status() { return status; }
    public Set<String> identifiers() { return identifiers; }

    public static <T extends Throwable> T attach(T error, HttpResponse<String> response) {
        return attach(error, response.statusCode(), response.headers(), response.body());
    }

    public static <T extends Throwable> T attach(T error, int status, java.net.http.HttpHeaders headers, String body) {
        Set<String> ids = new LinkedHashSet<>();
        if (headers != null) for (String name : HEADERS)
            headers.allValues(name).forEach(value -> add(ids, name, value));
        try { readIds(JSON.readTree(body), ids, 0); }
        catch (Exception ignored) { ids.addAll(legacyIdentifiers(body)); }
        error.addSuppressed(new ProviderResponseDiagnostics(status, ids));
        return error;
    }

    /** Older exceptions retained only a text diagnostic; retain the original field name for supplier searches. */
    public static Set<String> legacyIdentifiers(String text) {
        Set<String> ids = new LinkedHashSet<>();
        if (text == null) return ids;
        var matcher = LEGACY_ID.matcher(text);
        while (matcher.find() && ids.size() < 8) add(ids, matcher.group(1), matcher.group(2));
        return ids;
    }

    public static String safeId(String value) {
        return value != null && ID.matcher(value).matches()
                && !value.matches("(?i)(?:sk-|jsk_|ark-|bearer).*") ? value : null;
    }

    private static void add(Set<String> ids, String name, String value) {
        if (ids.size() < 8 && safeId(value) != null && !Set.of("null", "undefined").contains(value))
            ids.add(name + "=" + value);
    }

    private static void readIds(JsonNode node, Set<String> ids, int depth) {
        if (node == null || !node.isObject() || depth > 4) return;
        node.fields().forEachRemaining(field -> {
            String normalized = field.getKey().replaceAll("[_-]", "").toLowerCase(java.util.Locale.ROOT);
            if (Set.of("logid", "requestid", "traceid").contains(normalized) && field.getValue().isValueNode())
                add(ids, field.getKey(), field.getValue().asText());
            else if (Set.of("error", "data", "metadata", "responsemetadata", "result").contains(normalized))
                readIds(field.getValue(), ids, depth + 1);
        });
    }
}
