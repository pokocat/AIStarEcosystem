package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.net.URI;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** The browser page that initiated a task. Keep it with the task across async dispatch and restarts. */
public final class ModelTaskOrigin {
    public static final String KEY = "alertPage";
    private static final Set<String> PRODUCT_HOSTS = Set.of("aibuzz.cn", "aiavatar.aibuzz.cn", "aistar.aibuzz.cn",
            "ipstudio.aibuzz.cn", "celebrity.aibuzz.cn", "drama.aibuzz.cn", "music.aibuzz.cn", "star.aibuzz.cn");
    private static final Set<String> ROUTE_PARAMS = Set.of("scene", "draft", "task", "tool", "tab", "project", "projectId");

    private ModelTaskOrigin() {}

    public static String currentPage() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) return "";
        var request = attributes.getRequest();
        String explicit = safePage(request.getHeader("X-Aibuzz-Page"));
        if (!explicit.isEmpty()) return explicit;
        String referer = safePage(request.getHeader("Referer"));
        // Cross-origin browser requests may send only the site's origin.
        return referer.matches("https://[^/]+/?") ? "" : referer;
    }

    public static String read(JsonNode snapshot) {
        return safePage(snapshot.path(KEY).asText(null));
    }

    public static void save(ObjectNode snapshot, String page) {
        String safe = safePage(page);
        if (!safe.isEmpty()) snapshot.put(KEY, safe);
    }

    static String safePage(String value) {
        if (value == null || value.length() > 2048) return "";
        try {
            URI uri = URI.create(value);
            String host = uri.getHost();
            String path = uri.getRawPath();
            if (host == null || uri.getRawUserInfo() != null || path == null || !path.matches("/[A-Za-z0-9_./~-]{0,768}")
                    || path.startsWith("//") || !uri.normalize().getRawPath().equals(path)) return "";
            boolean allowed = "https".equals(uri.getScheme()) && PRODUCT_HOSTS.contains(host)
                    && (uri.getPort() == -1 || uri.getPort() == 443);
            if (!allowed) return "";
            if (path.startsWith("/api/") || path.startsWith("/invite/") || path.contains("/callback")) return "";
            String query = uri.getRawQuery();
            String selectors = query == null ? "" : Arrays.stream(query.split("&"))
                    .filter(p -> p.matches("[A-Za-z]+=[A-Za-z0-9_-]{1,96}") && ROUTE_PARAMS.contains(p.substring(0, p.indexOf('='))))
                    .distinct().limit(ROUTE_PARAMS.size()).collect(Collectors.joining("&"));
            return "https://" + host + path + (selectors.isEmpty() ? "" : "?" + selectors);
        } catch (IllegalArgumentException invalid) {
            return "";
        }
    }
}
