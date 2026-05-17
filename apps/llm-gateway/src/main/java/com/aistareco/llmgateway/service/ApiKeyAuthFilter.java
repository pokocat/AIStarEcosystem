package com.aistareco.llmgateway.service;

import com.aistareco.llmgateway.config.GatewayProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 业务侧 sk-aep-* 鉴权过滤器。
 *
 * llm-gateway.business-auth.enabled=false 时整个过滤器是 no-op，任何调用都放行。
 *
 * 启用时：
 *   - 没带 Authorization → 401
 *   - 调 apps/server /api/internal/llm-keys/validate 校验
 *   - 成功结果缓存 ttl 秒，命中复用
 *   - 把 keyId/userId 写入 exchange attribute 供 ChatController + UsageReporter 取
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiKeyAuthFilter implements WebFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyAuthFilter.class);

    private final GatewayProperties props;
    private final WebClient client;
    private final ObjectMapper om = new ObjectMapper();
    private final ConcurrentHashMap<String, CachedEntry> cache = new ConcurrentHashMap<>();

    public ApiKeyAuthFilter(GatewayProperties props, WebClient.Builder builder) {
        this.props = props;
        this.client = builder.baseUrl(props.getAdminSync().getServerBaseUrl()).build();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        // 只拦 /v1/chat 和 /v1/embeddings；healthz / models 直接放行
        if (!path.startsWith("/v1/chat") && !path.startsWith("/v1/embeddings")) {
            return chain.filter(exchange);
        }
        if (!props.getBusinessAuth().isEnabled()) {
            return chain.filter(exchange);
        }
        String auth = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (auth == null || !auth.startsWith("Bearer ")) {
            return deny(exchange, "missing_authorization");
        }
        String token = auth.substring("Bearer ".length()).trim();
        if (token.isEmpty()) {
            return deny(exchange, "missing_token");
        }
        return validate(token)
                .flatMap(key -> {
                    exchange.getAttributes().put(AuthenticatedKey.ATTR, key);
                    return chain.filter(exchange);
                })
                .onErrorResume(e -> {
                    log.warn("api key validate 失败: {}", e.getMessage());
                    return deny(exchange, "validate_error");
                });
    }

    private Mono<AuthenticatedKey> validate(String token) {
        int ttl = props.getBusinessAuth().getCacheTtlSeconds();
        CachedEntry hit = cache.get(token);
        if (hit != null && hit.expiresAt.isAfter(Instant.now())) {
            return hit.key != null ? Mono.just(hit.key) : Mono.error(new IllegalStateException(hit.reason));
        }
        return client.post()
                .uri("/api/internal/llm-keys/validate")
                .header("X-Internal-Secret", props.getAdminSync().getSecret())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("apiKey", token))
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(5))
                .flatMap(body -> {
                    try {
                        JsonNode data = om.readTree(body).path("data");
                        if (data.path("ok").asBoolean()) {
                            AuthenticatedKey k = new AuthenticatedKey(
                                    data.path("keyId").asText(),
                                    data.path("userId").asText(),
                                    data.path("name").asText()
                            );
                            cache.put(token, new CachedEntry(k, null, Instant.now().plusSeconds(ttl)));
                            return Mono.just(k);
                        }
                        String reason = data.path("reason").asText("invalid");
                        cache.put(token, new CachedEntry(null, reason, Instant.now().plusSeconds(Math.min(ttl, 10))));
                        return Mono.error(new IllegalStateException(reason));
                    } catch (Exception e) {
                        return Mono.error(e);
                    }
                });
    }

    private Mono<Void> deny(ServerWebExchange exchange, String reason) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = ("{\"error\":{\"code\":\"unauthorized\",\"message\":\"" + reason + "\"}}")
                .getBytes(StandardCharsets.UTF_8);
        return exchange.getResponse().writeWith(Mono.just(
                exchange.getResponse().bufferFactory().wrap(body)));
    }

    private record CachedEntry(AuthenticatedKey key, String reason, Instant expiresAt) {}
}
