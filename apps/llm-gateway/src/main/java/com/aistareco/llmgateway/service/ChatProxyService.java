package com.aistareco.llmgateway.service;

import com.aistareco.llmgateway.upstream.Upstream;
import com.aistareco.llmgateway.upstream.UpstreamRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 把客户端的 OpenAI 格式 chat/completions 请求转发到对应 upstream。
 * 火山方舟 / 阿里 DashScope compatible-mode 都原生 OpenAI 协议——网关只做：
 *   选 upstream → 替换 Authorization → 透传 body → 末尾上报 usage（如果开启 business-auth）
 */
@Service
public class ChatProxyService {

    private static final Logger log = LoggerFactory.getLogger(ChatProxyService.class);

    private final UpstreamRegistry registry;
    private final WebClient.Builder webClientBuilder;
    private final UsageReporter usageReporter;
    private final ObjectMapper om = new ObjectMapper();

    public ChatProxyService(UpstreamRegistry registry, WebClient.Builder webClientBuilder,
                             UsageReporter usageReporter) {
        this.registry = registry;
        this.webClientBuilder = webClientBuilder;
        this.usageReporter = usageReporter;
    }

    public Mono<ResponseEntity<String>> forwardNonStream(Map<String, Object> body,
                                                          AuthenticatedKey key, String requestId,
                                                          String purpose, String appCode) {
        Upstream up = pick(body);
        String model = String.valueOf(body.get("model"));
        WebClient client = clientFor(up);
        long startNanos = System.nanoTime();
        log.info("chat (non-stream) reqId={} upstream={} model={}", requestId, up.id(), model);
        return client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .toEntity(String.class)
                .doOnSuccess(resp -> tryReport(resp, model, key, requestId, purpose, appCode, elapsedMs(startNanos)))
                .onErrorResume(WebClientResponseException.class, e -> {
                    log.warn("upstream {} HTTP {}: {}", up.id(), e.getStatusCode(), e.getResponseBodyAsString());
                    usageReporter.reportFailure(key, null, model, requestId, purpose, appCode,
                            elapsedMs(startNanos), "HTTP_" + e.getStatusCode().value(), truncate(e.getResponseBodyAsString(), 512));
                    return Mono.just(ResponseEntity.status(e.getStatusCode())
                            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                            .body(e.getResponseBodyAsString()));
                })
                .onErrorResume(Exception.class, e -> {
                    log.warn("upstream {} exception: {}", up.id(), e.toString());
                    usageReporter.reportFailure(key, null, model, requestId, purpose, appCode,
                            elapsedMs(startNanos), e.getClass().getSimpleName(), truncate(e.getMessage(), 512));
                    return Mono.error(e);
                });
    }

    public Flux<String> forwardStream(Map<String, Object> body,
                                       AuthenticatedKey key, String requestId,
                                       String purpose, String appCode) {
        Upstream up = pick(body);
        String model = String.valueOf(body.get("model"));
        WebClient client = clientFor(up);
        long startNanos = System.nanoTime();
        log.info("chat (stream) reqId={} upstream={} model={}", requestId, up.id(), model);

        AtomicLong promptTokens = new AtomicLong();
        AtomicLong completionTokens = new AtomicLong();
        AtomicReference<String> upstreamId = new AtomicReference<>();

        return client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(body)
                .retrieve()
                .bodyToFlux(String.class)
                .doOnNext(chunk -> sniffStreamChunk(chunk, promptTokens, completionTokens, upstreamId))
                .doOnComplete(() -> {
                    if (key != null && (promptTokens.get() > 0 || completionTokens.get() > 0)) {
                        usageReporter.report(key, upstreamId.get(), model,
                                promptTokens.get(), completionTokens.get(), requestId, purpose, appCode, elapsedMs(startNanos));
                    }
                })
                .onErrorResume(WebClientResponseException.class, e -> {
                    log.warn("upstream {} stream HTTP {}: {}", up.id(), e.getStatusCode(), e.getResponseBodyAsString());
                    usageReporter.reportFailure(key, upstreamId.get(), model, requestId, purpose, appCode,
                            elapsedMs(startNanos), "HTTP_" + e.getStatusCode().value(), truncate(e.getResponseBodyAsString(), 512));
                    String errJson = String.format(
                            "{\"error\":{\"code\":\"upstream_%d\",\"message\":%s}}",
                            e.getStatusCode().value(),
                            quote(e.getResponseBodyAsString()));
                    return Flux.just(errJson);
                })
                .onErrorResume(Exception.class, e -> {
                    log.warn("upstream {} stream exception: {}", up.id(), e.toString());
                    usageReporter.reportFailure(key, upstreamId.get(), model, requestId, purpose, appCode,
                            elapsedMs(startNanos), e.getClass().getSimpleName(), truncate(e.getMessage(), 512));
                    return Flux.error(e);
                });
    }

    private void tryReport(ResponseEntity<String> resp, String model,
                           AuthenticatedKey key, String requestId,
                           String purpose, String appCode, long latencyMs) {
        if (key == null) return;
        if (resp.getStatusCode().isError()) return;
        try {
            JsonNode root = om.readTree(resp.getBody());
            JsonNode node = root.path("usage");
            long pt = node.path("prompt_tokens").asLong(0);
            long ct = node.path("completion_tokens").asLong(0);
            String upstreamId = root.path("id").asText(null);
            if (pt > 0 || ct > 0) {
                usageReporter.report(key, upstreamId, model, pt, ct, requestId, purpose, appCode, latencyMs);
            }
        } catch (Exception ignored) { /* 上游可能不返 usage，忽略 */ }
    }

    private void sniffStreamChunk(String chunk, AtomicLong pt, AtomicLong ct, AtomicReference<String> upstreamId) {
        if (chunk == null || chunk.isBlank() || chunk.startsWith("[DONE]")) return;
        try {
            JsonNode root = om.readTree(chunk);
            String id = root.path("id").asText(null);
            if (id != null && !id.isBlank()) upstreamId.compareAndSet(null, id);
            JsonNode usage = root.path("usage");
            if (!usage.isMissingNode() && !usage.isNull()) {
                long p = usage.path("prompt_tokens").asLong(0);
                long c = usage.path("completion_tokens").asLong(0);
                if (p > 0) pt.set(p);
                if (c > 0) ct.set(c);
            }
        } catch (Exception ignored) { /* 不是 JSON 或 schema 不同，忽略 */ }
    }

    private Upstream pick(Map<String, Object> body) {
        Object model = body.get("model");
        if (!(model instanceof String s) || s.isBlank()) {
            throw new IllegalArgumentException("缺少 model 字段");
        }
        return registry.findForModel(s)
                .orElseThrow(() -> new IllegalArgumentException(
                        "未找到匹配 model=" + s + " 的 upstream（检查 llm-gateway.upstreams[].modelPrefixes）"));
    }

    private WebClient clientFor(Upstream up) {
        return webClientBuilder
                .baseUrl(up.baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + up.apiKey())
                .build();
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }

    private String quote(String s) {
        try {
            return om.writeValueAsString(s == null ? "" : s);
        } catch (Exception e) {
            return "\"\"";
        }
    }
}
