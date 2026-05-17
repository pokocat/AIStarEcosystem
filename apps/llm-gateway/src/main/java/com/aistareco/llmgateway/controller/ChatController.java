package com.aistareco.llmgateway.controller;

import com.aistareco.llmgateway.service.AuthenticatedKey;
import com.aistareco.llmgateway.service.ChatProxyService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class ChatController {

    private final ChatProxyService chatProxy;

    public ChatController(ChatProxyService chatProxy) {
        this.chatProxy = chatProxy;
    }

    /**
     * OpenAI 兼容的 /v1/chat/completions。
     *   - body.stream = true  → text/event-stream，逐 chunk 透传
     *   - body.stream 缺省/false → application/json
     */
    @PostMapping(value = "/chat/completions", produces = {
            MediaType.APPLICATION_JSON_VALUE,
            MediaType.TEXT_EVENT_STREAM_VALUE
    })
    public Object chatCompletions(@RequestBody Map<String, Object> body, ServerWebExchange exchange) {
        boolean stream = Boolean.TRUE.equals(body.get("stream"));
        AuthenticatedKey key = (AuthenticatedKey) exchange.getAttributes().get(AuthenticatedKey.ATTR);
        String requestId = "req-" + UUID.randomUUID().toString().substring(0, 12);
        if (stream) {
            return chatProxy.forwardStream(body, key, requestId)
                    .map(chunk -> ServerSentEvent.<String>builder(chunk).build());
        }
        return chatProxy.forwardNonStream(body, key, requestId);
    }

    @GetMapping("/models")
    public Mono<ResponseEntity<Map<String, Object>>> listModels() {
        return Mono.just(ResponseEntity.ok(Map.of(
                "object", "list",
                "data", List.of()
        )));
    }

    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "ai-star-eco-llm-gateway");
    }
}
