package com.aistareco.aep.service.picgen;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * v0.16+: 调独立的 pic-gen 服务（默认 http://localhost:5173）的 /render-png 端点，
 * 返回一张 PNG 字节流。该服务由独立 Node 进程承载 puppeteer 浏览器实例，复用启动开销。
 * <p>
 * 失败语义：网络错误 / 4xx / 5xx 都抛 {@link PicgenException}，调用方自行决定 fall-through
 * （比如 mixcut 渲染时把这个变体的图跳过、不让整任务 failed）。
 */
@Service
public class PicgenClient {

    private static final Logger log = LoggerFactory.getLogger(PicgenClient.class);

    private final boolean enabled;
    private final String baseUrl;
    private final Duration timeout;
    private final HttpClient http;

    public PicgenClient(
            @Value("${aep.picgen.enabled:true}") boolean enabled,
            @Value("${aep.picgen.base-url:http://localhost:5173}") String baseUrl,
            @Value("${aep.picgen.timeout-ms:15000}") int timeoutMs
    ) {
        this.enabled = enabled;
        // 去尾 /
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.timeout = Duration.ofMillis(Math.max(2000, timeoutMs));
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** 调 /render-png 返回 PNG 字节流。 */
    public byte[] renderPng(PicgenParams p) {
        if (!enabled) {
            throw new PicgenException("pic-gen 已通过 aep.picgen.enabled=false 关闭");
        }
        if (p == null || p.title() == null || p.title().isBlank()) {
            throw new PicgenException("title 不能为空");
        }
        String url = baseUrl + "/render-png?" + p.toQueryString();
        var req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(timeout)
                .GET()
                .build();
        try {
            HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            int code = res.statusCode();
            if (code != 200) {
                String body = new String(res.body(), StandardCharsets.UTF_8);
                log.warn("pic-gen /render-png HTTP {} ({} chars body)", code, body.length());
                throw new PicgenException("pic-gen 返回 HTTP " + code + ": " + truncate(body, 200));
            }
            byte[] data = res.body();
            if (data == null || data.length < 32) {
                throw new PicgenException("pic-gen 返回空 PNG");
            }
            return data;
        } catch (PicgenException pe) {
            throw pe;
        } catch (Exception e) {
            log.warn("pic-gen 调用失败: {}", e.toString());
            throw new PicgenException("pic-gen 调用失败: " + e.getMessage(), e);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /**
     * 调用参数。title 必填，其他都可选。
     * 当 template / scheme / font 留空时，pic-gen 服务会按 seed 在内置池里抽 —— 相同 seed 抽相同组合，
     * 用于 mixcut 多变体下游的确定性差异化。
     */
    public record PicgenParams(
            String title,
            String subtitle,
            String tag,
            Integer width,
            Integer height,
            Long seed,
            String template,
            String scheme,
            String font
    ) {
        public String toQueryString() {
            StringBuilder sb = new StringBuilder();
            appendParam(sb, "title", title);
            appendParam(sb, "subtitle", subtitle);
            appendParam(sb, "tag", tag);
            if (width != null) appendParam(sb, "width", String.valueOf(width));
            if (height != null) appendParam(sb, "height", String.valueOf(height));
            if (seed != null) appendParam(sb, "seed", String.valueOf(seed));
            appendParam(sb, "template", template);
            appendParam(sb, "scheme", scheme);
            appendParam(sb, "font", font);
            return sb.toString();
        }

        private static void appendParam(StringBuilder sb, String k, String v) {
            if (v == null || v.isBlank()) return;
            if (sb.length() > 0) sb.append('&');
            sb.append(k).append('=').append(URLEncoder.encode(v, StandardCharsets.UTF_8));
        }
    }

    /** pic-gen 调用异常（运行期）。 */
    public static class PicgenException extends RuntimeException {
        public PicgenException(String m) { super(m); }
        public PicgenException(String m, Throwable c) { super(m, c); }
    }
}
