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
                        long promptTokens, long completionTokens, String requestId) {
        if (key == null || !props.getBusinessAuth().isEnabled()) return;
        Map<String, Object> body = new HashMap<>();
        body.put("keyId", key.keyId());
        body.put("requestId", requestId);
        body.put("upstreamId", upstreamId);
        body.put("model", model);
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
}
