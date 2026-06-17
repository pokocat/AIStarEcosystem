package com.aistareco.aep.controller;

import com.aistareco.aep.service.EmbeddedLlmProxyService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Map;
import java.util.UUID;

/** OpenAI-compatible LLM API, served directly by apps/server. */
@RestController
@RequestMapping({"/api/llm/v1", "/v1"})
public class EmbeddedLlmProxyController {

    private static final ObjectMapper OM = new ObjectMapper();

    private final EmbeddedLlmProxyService service;

    public EmbeddedLlmProxyController(EmbeddedLlmProxyService service) {
        this.service = service;
    }

    @PostMapping(value = "/chat/completions", produces = {
            MediaType.APPLICATION_JSON_VALUE,
            MediaType.TEXT_EVENT_STREAM_VALUE
    })
    public Object chatCompletions(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        String requestId = "llm-" + UUID.randomUUID().toString().substring(0, 12);
        String purpose = firstNonBlank(request.getHeader("X-AI-Purpose"), stringValue(body.get("purpose")));
        String appCode = request.getHeader("X-App-Code");
        try {
            if (Boolean.TRUE.equals(body.get("stream"))) {
                return service.stream(body, request.getHeader(HttpHeaders.AUTHORIZATION), requestId, purpose, appCode);
            }
            return service.chat(body, request.getHeader(HttpHeaders.AUTHORIZATION), requestId, purpose, appCode);
        } catch (BusinessException e) {
            return openAiError(e.getStatus(), e.getCode(), e.getMessage());
        }
    }

    @GetMapping("/models")
    public Map<String, Object> models() {
        return service.models();
    }

    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "ai-star-eco-server-llm");
    }

    private static ResponseEntity<String> openAiError(HttpStatus status, String code, String message) {
        try {
            return ResponseEntity.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(OM.writeValueAsString(Map.of("error", Map.of("code", code, "message", message))));
        } catch (Exception e) {
            return ResponseEntity.status(status).body("{\"error\":{\"code\":\"" + code + "\"}}");
        }
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first.trim();
        if (second != null && !second.isBlank()) return second.trim();
        return null;
    }
}
