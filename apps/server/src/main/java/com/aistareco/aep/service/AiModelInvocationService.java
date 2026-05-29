package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
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
 * 大模型调用门面（v0.5 §D8 新增；providerType 兼容集后续放宽）。
 *
 * 走 OpenAI /chat/completions + /v1/models wire 协议的 provider 都支持，即除
 * ANTHROPIC（Messages API：x-api-key 头 + 不同 body）与 AZURE_OPENAI
 * （api-key 头 + ?api-version= + deployment 在路径）以外的所有 providerType。
 * 国产厂商（VOLCENGINE / ALIYUN / MOONSHOT / DEEPSEEK / BAIDU / TENCENT / CUSTOM 等）
 * 几乎都提供 OpenAI 兼容端点，统一走同一分支；ANTHROPIC / AZURE_OPENAI 需独立适配，调用时抛 501。
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

    /** 不走 OpenAI wire（/chat/completions + /v1/models）、需独立适配的 providerType。 */
    private static final EnumSet<AiModelProviderType> NON_OPENAI_WIRE =
            EnumSet.of(AiModelProviderType.ANTHROPIC, AiModelProviderType.AZURE_OPENAI);

    private final AiModelProviderRepository repo;
    private final AiModelUsageService usage;

    public AiModelInvocationService(AiModelProviderRepository repo, AiModelUsageService usage) {
        this.repo = repo;
        this.usage = usage;
    }

    /** 是否存在该用途的启用 provider（用于上层在调用前判断「未配置大模型」并给出明确提示）。 */
    public boolean hasProviderFor(AiModelPurpose purpose) {
        return !pickProviders(purpose).isEmpty();
    }

    /** 简易 chat：messages = [{role, content}, ...]。 */
    public AiModelResponse invokeChat(AiModelPurpose purpose, List<Map<String, String>> messages,
                                       Map<String, Object> options) {        List<AiModelProvider> candidates = pickProviders(purpose);
        BusinessException lastErr = null;
        for (AiModelProvider p : candidates) {
            try {
                return doChat(p, purpose, messages, options);
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
        if (!isOpenAiCompatible(type)) {
            return Map.of("ok", false,
                    "error", "providerType=" + type.wire() + " 暂不支持连通测试（仅 ANTHROPIC / AZURE_OPENAI 需独立适配）",
                    "providerType", type.wire());
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

    /**
     * 拉取服务商可用模型列表（GET {baseUrl}/models）。失败不抛异常，包成
     * AiModelDiscoveryResultDto.fail 返回，便于前端直接展示原因。
     */
    public AiModelDiscoveryResultDto listModels(AiModelProviderType type, String baseUrl, String apiKey) {
        if (type != null && !isOpenAiCompatible(type)) {
            return AiModelDiscoveryResultDto.fail(null,
                    "providerType=" + type.wire() + " 暂不支持模型发现（仅 ANTHROPIC / AZURE_OPENAI 需独立适配）");
        }
        if (baseUrl == null || baseUrl.isBlank()) return AiModelDiscoveryResultDto.fail(null, "baseUrl 为空");
        if (apiKey == null || apiKey.isBlank()) return AiModelDiscoveryResultDto.fail(null, "apiKey 为空");
        try {
            URI uri = URI.create(rstrip(baseUrl, "/") + "/models");
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                return AiModelDiscoveryResultDto.fail(resp.statusCode(),
                        "HTTP " + resp.statusCode() + ": " + snippet(resp.body()));
            }
            return AiModelDiscoveryResultDto.ok(resp.statusCode(), parseModelsResponse(resp.body()));
        } catch (Exception e) {
            return AiModelDiscoveryResultDto.fail(null, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private List<AiModelProvider> pickProviders(AiModelPurpose purpose) {
        String wire = purpose.wire();
        return repo.findByEnabledTrueOrderByPriorityAsc().stream()
                .filter(p -> p.getPurposes() != null && p.getPurposes().contains(wire))
                .toList();
    }

    private AiModelResponse doChat(AiModelProvider p, AiModelPurpose purpose, List<Map<String, String>> messages,
                                    Map<String, Object> options) throws Exception {
        AiModelProviderType type = p.getProviderType();
        if (!isOpenAiCompatible(type)) {
            throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PROVIDER_NOT_SUPPORTED",
                    "providerType=" + type.wire() + " 暂未实现（ANTHROPIC / AZURE_OPENAI 需独立适配；其余走 OpenAI 兼容）");
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
            // response_format 透传（如 {"type":"json_object"}）；provider 不支持时会自行忽略或报错，
            // 由调用方（MaterialAiService）catch 后走解析重试 / 兜底。
            if (options.get("response_format") != null) body.put("response_format", options.get("response_format"));
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
        Long promptTokens = null;
        Long completionTokens = null;
        Long tokensUsed = null;
        if (parsed.get("usage") instanceof Map<?, ?> usageMap) {
            promptTokens = asLong(usageMap.get("prompt_tokens"));
            completionTokens = asLong(usageMap.get("completion_tokens"));
            tokensUsed = asLong(usageMap.get("total_tokens"));
        }
        // v0.41：自建用量流水。best-effort，失败只 log，不阻断 chat 返回。
        usage.record(p.getId(), p.getName(), model,
                purpose != null ? purpose.wire() : null,
                promptTokens, completionTokens, tokensUsed, true);
        return new AiModelResponse(content, finishReason, tokensUsed, p.getName(), model);
    }

    private static Long asLong(Object o) {
        return o instanceof Number n ? n.longValue() : null;
    }

    private static String rstrip(String s, String suffix) {
        return s.endsWith(suffix) ? s.substring(0, s.length() - suffix.length()) : s;
    }

    /** 是否走 OpenAI 兼容 wire（除 ANTHROPIC / AZURE_OPENAI 外都是）。 */
    private static boolean isOpenAiCompatible(AiModelProviderType type) {
        return !NON_OPENAI_WIRE.contains(type);
    }

    /** 解析 OpenAI /models 响应 data[]；过滤 status=Shutdown/Retiring（火山方舟会带 status）。 */
    private static List<AiModelEntryDto> parseModelsResponse(String body) throws Exception {
        Map<?, ?> parsed = OM.readValue(body, Map.class);
        List<AiModelEntryDto> out = new ArrayList<>();
        if (parsed.get("data") instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) continue;
                Object id = m.get("id");
                if (id == null) continue;
                Object status = m.get("status");
                if (status != null) {
                    String s = String.valueOf(status);
                    if (s.equalsIgnoreCase("Shutdown") || s.equalsIgnoreCase("Retiring")) continue;
                }
                Object name = m.get("name");
                String label = name != null ? String.valueOf(name) : String.valueOf(id);
                out.add(new AiModelEntryDto(String.valueOf(id), label, null, null));
            }
        }
        return out;
    }

    private static String snippet(String body) {
        if (body == null) return "";
        return body.length() > 200 ? body.substring(0, 200) : body;
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
