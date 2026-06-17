package com.aistareco.llmgateway.service;

import com.aistareco.llmgateway.config.GatewayProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.HashMap;
import java.util.Map;

/**
 * 把 usage 异步推给 apps/server 写 LedgerEntry。
 * Fire-and-forget：失败仅 warn，不影响客户端响应。
 */
@Service
public class UsageReporter {

    private static final Logger log = LoggerFactory.getLogger(UsageReporter.class);

    private final GatewayProperties props;
    private final WebClient client;

    public UsageReporter(GatewayProperties props, WebClient.Builder builder) {
        this.props = props;
        this.client = builder.baseUrl(props.getAdminSync().getServerBaseUrl()).build();
    }

    public void report(AuthenticatedKey key, String upstreamId, String model,
                       long promptTokens, long completionTokens, String requestId,
                       String purpose, String appCode, Long latencyMs) {
        reportInternal(key, upstreamId, model, promptTokens, completionTokens, requestId, purpose, appCode,
                true, null, null, latencyMs);
    }

    public void reportFailure(AuthenticatedKey key, String upstreamId, String model,
                              String requestId, String purpose, String appCode,
                              Long latencyMs, String errorCode, String errorMessage) {
        reportInternal(key, upstreamId, model, 0, 0, requestId, purpose, appCode,
                false, errorCode, errorMessage, latencyMs);
    }

    private void reportInternal(AuthenticatedKey key, String upstreamId, String model,
                                long promptTokens, long completionTokens, String requestId,
                                String purpose, String appCode, boolean success,
                                String errorCode, String errorMessage, Long latencyMs) {
        if (key == null || !props.getBusinessAuth().isEnabled()) return;
        Map<String, Object> body = new HashMap<>();
        body.put("keyId", key.keyId());
        body.put("requestId", requestId);
        putIfPresent(body, "upstreamId", upstreamId);
        body.put("model", model);
        putIfPresent(body, "purpose", purpose);
        putIfPresent(body, "userId", key.userId());
        putIfPresent(body, "appCode", appCode);
        if (latencyMs != null && latencyMs >= 0) body.put("latencyMs", latencyMs);
        body.put("success", success);
        putIfPresent(body, "errorCode", errorCode);
        putIfPresent(body, "errorMessage", errorMessage);
        body.put("promptTokens", promptTokens);
        body.put("completionTokens", completionTokens);
        body.put("totalTokens", promptTokens + completionTokens);

        client.post()
                .uri("/api/internal/llm-keys/usage")
                .header("X-Internal-Secret", props.getAdminSync().getSecret())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                        ok -> log.debug("usage reported key={} tokens={}", key.keyId(), promptTokens + completionTokens),
                        err -> log.warn("usage report 失败 key={}: {}", key.keyId(), err.getMessage()));
    }

    private static void putIfPresent(Map<String, Object> body, String key, String value) {
        if (value != null && !value.isBlank()) body.put(key, value.trim());
    }
}
