package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * 大模型调用门面（v0.5 §D8；v0.41 改为按 AI 应用绑定解析单端点 + 自建用量流水）。
 *
 * 走 OpenAI /chat/completions + /v1/models wire 协议的端点都支持，即除
 * ANTHROPIC（Messages API）与 AZURE_OPENAI（api-key 头 + ?api-version=）以外的所有 providerType。
 * 国产厂商（VOLCENGINE / ALIYUN / MOONSHOT / DEEPSEEK / BAIDU / TENCENT / CUSTOM 等）
 * 几乎都提供 OpenAI 兼容端点，统一走同一分支；ANTHROPIC / AZURE_OPENAI 需独立适配，调用时抛 501。
 *
 * 选端点策略（v0.41）：purpose → {@code ai_app_binding} → 唯一启用端点；**无优先级 / 无 5xx 兜底**。
 * 每次成功 chat 落一条用量流水（{@link AiModelUsageService}，best-effort，绝不阻断业务）。
 */
@Service
public class AiModelInvocationService {

    private static final Logger log = LoggerFactory.getLogger(AiModelInvocationService.class);
    /** 大模型 I/O 全文流水（发给模型的最终提示词 + 模型原文返回），便于排查。
     *  独立 logger，运维可在 logback 单独调级别/落单独文件，不污染主 log。 */
    private static final Logger ioLog = LoggerFactory.getLogger("aep.ai.chat.io");
    private static final ObjectMapper OM = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    /** 不走 OpenAI wire（/chat/completions + /v1/models）、需独立适配的 providerType。 */
    private static final EnumSet<AiModelProviderType> NON_OPENAI_WIRE =
            EnumSet.of(AiModelProviderType.ANTHROPIC, AiModelProviderType.AZURE_OPENAI);

    private final AiModelEndpointRepository endpointRepo;
    private final AiAppBindingRepository bindingRepo;
    private final AiModelUsageService usage;

    public AiModelInvocationService(AiModelEndpointRepository endpointRepo,
                                    AiAppBindingRepository bindingRepo,
                                    AiModelUsageService usage) {
        this.endpointRepo = endpointRepo;
        this.bindingRepo = bindingRepo;
        this.usage = usage;
    }

    /** purpose → 绑定端点（启用）。无绑定 / 端点停用 / 端点不存在 → empty。 */
    public Optional<AiModelEndpoint> resolveEndpoint(AiModelPurpose purpose) {
        return bindingRepo.findById(purpose)
                .flatMap(b -> endpointRepo.findById(b.getEndpointId()))
                .filter(AiModelEndpoint::isEnabled);
    }

    /** 是否已为该用途绑定可用端点（上层在调用前判断「未配置」并给明确提示）。 */
    public boolean hasEndpointFor(AiModelPurpose purpose) {
        return resolveEndpoint(purpose).isPresent();
    }

    /** 简易 chat：messages = [{role, content}, ...]。单端点，无兜底。 */
    public AiModelResponse invokeChat(AiModelPurpose purpose, List<Map<String, String>> messages,
                                      Map<String, Object> options) {
        AiModelEndpoint endpoint = resolveEndpoint(purpose).orElse(null);
        if (endpoint == null) {
            log.warn("[ai-chat] blocked purpose={} reason=no-enabled-endpoint", purpose == null ? null : purpose.wire());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "未为用途 " + purpose.wire() + " 绑定可用的 AI 模型端点");
        }
        try {
            return doChat(endpoint, purpose, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[ai-chat] invoke exception purpose={} endpointId={} endpoint={} err={}",
                    purpose == null ? null : purpose.wire(), endpoint.getId(), endpoint.getName(), e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR",
                    "调用端点失败: " + endpoint.getName() + " - " + e.getMessage());
        }
    }

    /** 测试连通性：调 /v1/models（GET），200 即通过。 */
    public Map<String, Object> testConnection(String endpointId) {
        AiModelEndpoint e = endpointRepo.findById(endpointId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "ENDPOINT_NOT_FOUND",
                        "AI 模型端点不存在"));
        AiModelProviderType type = e.getProviderType();
        if (!isOpenAiCompatible(type)) {
            return Map.of("ok", false,
                    "error", "providerType=" + type.wire() + " 暂不支持连通测试（仅 ANTHROPIC / AZURE_OPENAI 需独立适配）",
                    "providerType", type.wire());
        }
        try {
            String apiKey = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
            URI uri = URI.create(rstrip(e.getBaseUrl(), "/") + "/models");
            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("Authorization", "Bearer " + apiKey)
                    .GET()
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                log.info("[ai-model] test-connection ok endpointId={} endpoint={} status={}",
                        e.getId(), e.getName(), resp.statusCode());
            } else {
                log.warn("[ai-model] test-connection failed endpointId={} endpoint={} status={} body={}",
                        e.getId(), e.getName(), resp.statusCode(), snippet(resp.body()));
            }
            return Map.of(
                    "ok", resp.statusCode() == 200,
                    "statusCode", resp.statusCode(),
                    "snippet", resp.body() == null ? "" : (resp.body().length() > 200 ? resp.body().substring(0, 200) : resp.body())
            );
        } catch (Exception ex) {
            log.warn("[ai-model] test-connection exception endpointId={} endpoint={} err={}",
                    e.getId(), e.getName(), ex.toString());
            return Map.of("ok", false, "error", ex.getClass().getSimpleName() + ": " + ex.getMessage());
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
                log.warn("[ai-model] discover-models failed providerType={} baseUrl={} status={} body={}",
                        type == null ? null : type.wire(), baseUrl, resp.statusCode(), snippet(resp.body()));
                return AiModelDiscoveryResultDto.fail(resp.statusCode(),
                        "HTTP " + resp.statusCode() + ": " + snippet(resp.body()));
            }
            List<AiModelEntryDto> models = parseModelsResponse(resp.body());
            log.info("[ai-model] discover-models ok providerType={} baseUrl={} status={} count={}",
                    type == null ? null : type.wire(), baseUrl, resp.statusCode(), models.size());
            return AiModelDiscoveryResultDto.ok(resp.statusCode(), models);
        } catch (Exception e) {
            log.warn("[ai-model] discover-models exception providerType={} baseUrl={} err={}",
                    type == null ? null : type.wire(), baseUrl, e.toString());
            return AiModelDiscoveryResultDto.fail(null, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private AiModelResponse doChat(AiModelEndpoint e, AiModelPurpose purpose, List<Map<String, String>> messages,
                                   Map<String, Object> options) throws Exception {
        AiModelProviderType type = e.getProviderType();
        if (!isOpenAiCompatible(type)) {
            log.warn("[ai-chat] provider unsupported purpose={} endpointId={} providerType={}",
                    purpose == null ? null : purpose.wire(), e.getId(), type == null ? null : type.wire());
            throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PROVIDER_NOT_SUPPORTED",
                    "providerType=" + type.wire() + " 暂未实现（ANTHROPIC / AZURE_OPENAI 需独立适配；其余走 OpenAI 兼容）");
        }
        String apiKey = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
        String model = options != null && options.get("model") != null
                ? String.valueOf(options.get("model"))
                : (e.getModel() != null ? e.getModel() : "gpt-4o");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        if (options != null) {
            if (options.get("temperature") != null) body.put("temperature", options.get("temperature"));
            if (options.get("max_tokens") != null) body.put("max_tokens", options.get("max_tokens"));
            // response_format 透传（如 {"type":"json_object"}）；端点不支持时会自行忽略或报错，
            // 由调用方（MaterialAiService）catch 后走解析重试 / 兜底。
            if (options.get("response_format") != null) body.put("response_format", options.get("response_format"));
        }
        URI uri = URI.create(rstrip(e.getBaseUrl(), "/") + "/chat/completions");
        long startNanos = System.nanoTime();
        log.info("[ai-chat] invoke start purpose={} endpointId={} endpoint={} providerType={} model={} messages={} maxTokens={} jsonMode={}",
                purpose == null ? null : purpose.wire(),
                e.getId(),
                e.getName(),
                type == null ? null : type.wire(),
                model,
                messages == null ? 0 : messages.size(),
                options == null ? null : options.get("max_tokens"),
                hasJsonMode(options));
        // 发给大模型的最终提示词全文（排查用）。独立 logger，默认 INFO，可单独降级/落盘。
        if (ioLog.isInfoEnabled()) {
            try {
                ioLog.info("[ai-chat-io] REQUEST purpose={} endpoint={} model={} messages={}",
                        purpose == null ? null : purpose.wire(), e.getName(), model, OM.writeValueAsString(messages));
            } catch (Exception ignore) { /* 序列化失败不阻塞主链路 */ }
        }
        HttpRequest req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(OM.writeValueAsString(body)))
                .build();
        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            log.warn("[ai-chat] invoke http-error purpose={} endpointId={} endpoint={} model={} status={} durationMs={} body={}",
                    purpose == null ? null : purpose.wire(), e.getId(), e.getName(), model,
                    resp.statusCode(), elapsedMs(startNanos), snippet(resp.body()));
            // 不把上游响应体 / 端点名 / HTTP 状态直出给用户（脱敏）；技术细节进 ErrorLog 供「追查号」排障。
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                    "AI 生成失败，请稍后重试",
                    "endpoint=" + e.getName() + " purpose=" + (purpose == null ? null : purpose.wire())
                            + " model=" + model + " status=" + resp.statusCode() + " body=" + snippet(resp.body()));
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
        // 模型原文返回全文（排查用）。
        if (ioLog.isInfoEnabled()) {
            ioLog.info("[ai-chat-io] RESPONSE purpose={} model={} finish={} content={}",
                    purpose == null ? null : purpose.wire(), model, finishReason, content);
        }
        // v0.41：自建用量流水。best-effort，失败只 log，不阻断 chat 返回。
        usage.record(e.getId(), e.getName(), model,
                purpose != null ? purpose.wire() : null,
                promptTokens, completionTokens, tokensUsed, true);
        log.info("[ai-chat] invoke ok purpose={} endpointId={} endpoint={} model={} finish={} tokens={} promptTokens={} completionTokens={} contentLength={} durationMs={}",
                purpose == null ? null : purpose.wire(),
                e.getId(),
                e.getName(),
                model,
                finishReason,
                tokensUsed,
                promptTokens,
                completionTokens,
                content == null ? 0 : content.length(),
                elapsedMs(startNanos));
        return new AiModelResponse(content, finishReason, tokensUsed, e.getName(), model);
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

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static boolean hasJsonMode(Map<String, Object> options) {
        Object rf = options == null ? null : options.get("response_format");
        if (rf instanceof Map<?, ?> m) {
            Object type = m.get("type");
            return type != null && "json_object".equalsIgnoreCase(String.valueOf(type));
        }
        return false;
    }

    /** chat 调用结果。 */
    public record AiModelResponse(
            String content,
            String finishReason,
            Long tokensUsed,
            String endpointUsed,
            String modelUsed
    ) {}
}
