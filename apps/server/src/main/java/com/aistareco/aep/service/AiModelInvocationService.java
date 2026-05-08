package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * 大模型调用门面（v0.5 §D8 新增）。
 *
 * 本期实现：OPENAI / OPENAI_COMPATIBLE 的 /chat/completions 调用。
 * 其他 providerType（ANTHROPIC / 国产）保留 enum 与 admin CRUD，但 invokeChat 时抛 501。
 *
 * 选 provider 策略：按 purpose 过滤启用项 → 按 priority 升序取第一个。
 * fallback：若失败，用同 purpose priority 次高的 provider 重试一次。
 */
@Service
public class AiModelInvocationService {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    private final AiModelProviderRepository repo;

    public AiModelInvocationService(AiModelProviderRepository repo) {
        this.repo = repo;
    }

    /** 简易 chat：messages = [{role, content}, ...]。 */
    public AiModelResponse invokeChat(AiModelPurpose purpose, List<Map<String, String>> messages,
                                       Map<String, Object> options) {
        List<AiModelProvider> candidates = pickProviders(purpose);
        BusinessException lastErr = null;
        for (AiModelProvider p : candidates) {
            try {
                return doChat(p, messages, options);
            } catch (BusinessException e) {
                lastErr = e;
                if (e.getStatus() != null && e.getStatus().is5xxServerError()) continue;
                // 4xx 直接抛出，不 fallback
                throw e;
            } catch (Exception e) {
                lastErr = new BusinessException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR",
                        "调用 provider 失败: " + p.getName() + " - " + e.getMessage());
            }
        }
        if (lastErr != null) throw lastErr;
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "NO_PROVIDER",
                "没有可用的 provider for purpose=" + purpose.wire());
    }

    /** 测试连通性：调 /v1/models（GET），200 即通过。 */
    public Map<String, Object> testConnection(String providerId) {
        AiModelProvider p = repo.findById(providerId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PROVIDER_NOT_FOUND",
                        "provider 不存在"));
        AiModelProviderType type = p.getProviderType();
        if (type != AiModelProviderType.OPENAI && type != AiModelProviderType.OPENAI_COMPATIBLE) {
            return Map.of("ok", false, "error", "v0.5 仅支持 OPENAI / OPENAI_COMPATIBLE 类型测试连通", "providerType", type.wire());
        }
        try {
            String apiKey = AepCryptoUtil.decrypt(p.getApiKeyEncrypted());
            URI uri = URI.create(rstrip(p.getBaseUrl(), "/") + "/models");
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            return Map.of(
                    "ok", resp.statusCode() == 200,
                    "statusCode", resp.statusCode(),
                    "snippet", resp.body() == null ? "" : (resp.body().length() > 200 ? resp.body().substring(0, 200) : resp.body())
            );
        } catch (Exception e) {
            return Map.of("ok", false, "error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private List<AiModelProvider> pickProviders(AiModelPurpose purpose) {
        String wire = purpose.wire();
        return repo.findByEnabledTrueOrderByPriorityAsc().stream()
                .filter(p -> p.getPurposes() != null && p.getPurposes().contains(wire))
                .toList();
    }

    private AiModelResponse doChat(AiModelProvider p, List<Map<String, String>> messages,
                                    Map<String, Object> options) throws Exception {
        AiModelProviderType type = p.getProviderType();
        if (type != AiModelProviderType.OPENAI && type != AiModelProviderType.OPENAI_COMPATIBLE) {
            throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PROVIDER_NOT_SUPPORTED",
                    "v0.5 仅实现 OPENAI / OPENAI_COMPATIBLE；当前 providerType=" + type.wire());
        }
        String apiKey = AepCryptoUtil.decrypt(p.getApiKeyEncrypted());
        String model = options != null && options.get("model") != null
                ? String.valueOf(options.get("model"))
                : (p.getDefaultModel() != null ? p.getDefaultModel() : "gpt-4o");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        if (options != null) {
            if (options.get("temperature") != null) body.put("temperature", options.get("temperature"));
            if (options.get("max_tokens") != null) body.put("max_tokens", options.get("max_tokens"));
        }
        URI uri = URI.create(rstrip(p.getBaseUrl(), "/") + "/chat/completions");
        HttpRequest req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                .build();
        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new BusinessException(HttpStatus.valueOf(resp.statusCode()),
                    "AI_PROVIDER_HTTP_" + resp.statusCode(),
                    "provider " + p.getName() + " HTTP " + resp.statusCode() + ": "
                            + (resp.body() == null ? "" : resp.body()));
        }
        Map<?, ?> parsed = OM.readValue(resp.body(), Map.class);
        Object choices = parsed.get("choices");
        String content = "";
        String finishReason = null;
        if (choices instanceof List<?> list && !list.isEmpty()) {
            Object first = list.get(0);
            if (first instanceof Map<?, ?> firstMap) {
                Object msg = firstMap.get("message");
                if (msg instanceof Map<?, ?> msgMap) {
                    Object c = msgMap.get("content");
                    if (c != null) content = String.valueOf(c);
                }
                Object fr = firstMap.get("finish_reason");
                if (fr != null) finishReason = String.valueOf(fr);
            }
        }
        Long tokensUsed = null;
        if (parsed.get("usage") instanceof Map<?, ?> usage
                && usage.get("total_tokens") instanceof Number n) {
            tokensUsed = n.longValue();
        }
        return new AiModelResponse(content, finishReason, tokensUsed, p.getName(), model);
    }

    private static String rstrip(String s, String suffix) {
        return s.endsWith(suffix) ? s.substring(0, s.length() - suffix.length()) : s;
    }

    /** chat 调用结果。 */
    public record AiModelResponse(
            String content,
            String finishReason,
            Long tokensUsed,
            String providerUsed,
            String modelUsed
    ) {}
}
