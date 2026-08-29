package com.aistareco.aep.service;

import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEntryDto;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiAppEndpointCandidateRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.aep.service.ai.ModelCallCtx;
import com.aistareco.aep.service.ai.UpstreamCallException;
import com.aistareco.aep.service.ai.UpstreamModelHttp;
import com.aistareco.common.AepCryptoUtil;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
    private final AiAppEndpointCandidateRepository candidateRepo;
    private final AiModelUsageService usage;
    private final AiModelGuardService guard;
    private final UpstreamModelHttp upstreamHttp;

    @Value("${aep.llm.chat-timeout-seconds:90}")
    private long chatTimeoutSeconds = 90;

    public AiModelInvocationService(AiModelEndpointRepository endpointRepo,
                                    AiAppBindingRepository bindingRepo,
                                    AiAppEndpointCandidateRepository candidateRepo,
                                    AiModelUsageService usage,
                                    AiModelGuardService guard,
                                    UpstreamModelHttp upstreamHttp) {
        this.endpointRepo = endpointRepo;
        this.bindingRepo = bindingRepo;
        this.candidateRepo = candidateRepo;
        this.usage = usage;
        this.guard = guard;
        this.upstreamHttp = upstreamHttp;
    }

    /** purpose → 绑定端点（启用）。无绑定 / 端点停用 / 端点不存在 → empty。行为零变化（D-11 仍读 AiAppBinding）。 */
    public Optional<AiModelEndpoint> resolveEndpoint(AiModelPurpose purpose) {
        return bindingRepo.findById(purpose)
                .flatMap(b -> endpointRepo.findById(b.getEndpointId()))
                .filter(AiModelEndpoint::isEnabled);
    }

    /**
     * D-11：purpose × endpointId → 解析候选端点（白名单）。endpointId 为空 → 委派默认端点（等价旧行为）。
     * 指定 endpointId 时必须是该用途的<b>启用 candidate</b>且端点启用，否则 empty（调用方抛 503
     * {@code ENDPOINT_NOT_ALLOWED}，§8.0：不静默回退默认、不扣费）。
     */
    public Optional<ResolvedEndpoint> resolveEndpoint(AiModelPurpose purpose, String endpointId) {
        if (endpointId == null || endpointId.isBlank()) {
            return resolveEndpoint(purpose).map(ep -> new ResolvedEndpoint(ep,
                    candidateRepo.findByPurposeAndEndpointId(purpose, ep.getId()).orElse(null), true));
        }
        return candidateRepo.findByPurposeAndEndpointId(purpose, endpointId)
                .filter(AiAppEndpointCandidate::isEnabled)
                .flatMap(c -> endpointRepo.findById(c.getEndpointId())
                        .filter(AiModelEndpoint::isEnabled)
                        .map(ep -> new ResolvedEndpoint(ep, c, isDefaultEndpoint(purpose, ep.getId()))));
    }

    /** D-11：列出某用途全部候选（含 capability + 默认标记），给 /render/models 与 admin。端点已删的孤儿候选跳过。 */
    public List<ResolvedEndpoint> listCandidates(AiModelPurpose purpose) {
        String defaultEndpointId = bindingRepo.findById(purpose).map(b -> b.getEndpointId()).orElse(null);
        List<ResolvedEndpoint> out = new ArrayList<>();
        for (AiAppEndpointCandidate c : candidateRepo.findByPurposeOrderBySortOrderAscCreatedAtAsc(purpose)) {
            AiModelEndpoint ep = endpointRepo.findById(c.getEndpointId()).orElse(null);
            if (ep == null) continue; // 孤儿候选（端点已删）→ 不展示
            out.add(new ResolvedEndpoint(ep, c, c.getEndpointId().equals(defaultEndpointId)));
        }
        return out;
    }

    private boolean isDefaultEndpoint(AiModelPurpose purpose, String endpointId) {
        return bindingRepo.findById(purpose).map(b -> endpointId.equals(b.getEndpointId())).orElse(false);
    }

    /** 解析到的候选端点：端点实体 + 承载能力/单价的 candidate（默认路径可能为 null）+ 是否默认。 */
    public record ResolvedEndpoint(AiModelEndpoint endpoint, AiAppEndpointCandidate candidate, boolean isDefault) {}

    /**
     * 视频候选的计价单位（wire 全小写）：只有「candidate 显式 override + 端点 PER_SECOND」才按秒，
     * 其余（含存量默认价）一律按次 —— drama /render/models 与 material /videos/models 共用同一判定，
     * 与 resolveCreditCostOverride 的展开语义保持一致。
     */
    public static String videoBillingUnit(AiModelEndpoint endpoint, AiAppEndpointCandidate candidate) {
        return candidate != null && candidate.getCreditCostOverride() != null
                && endpoint != null && endpoint.getBillingMode() == com.aistareco.aep.model.AiModelBillingMode.PER_SECOND
                ? "per_second" : "per_call";
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
            return doChat(endpoint, purpose, messages, options, null);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[ai-chat] invoke exception purpose={} endpointId={} endpoint={} err={}",
                    purpose == null ? null : purpose.wire(), endpoint.getId(), endpoint.getName(), e.toString());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_ERROR",
                    "调用端点失败: " + endpoint.getName() + " - " + e.getMessage());
        }
    }

    /** 管理端试运行 / 重放等场景：显式指定端点，仍使用同一调用与观测链路。 */
    public AiModelResponse invokeChatOnEndpoint(AiModelEndpoint endpoint, AiModelPurpose purpose,
                                                List<Map<String, String>> messages,
                                                Map<String, Object> options) {
        return invokeChatOnEndpoint(endpoint, purpose, messages, options, null);
    }

    public AiModelResponse invokeChatOnEndpoint(AiModelEndpoint endpoint, AiModelPurpose purpose,
                                                List<Map<String, String>> messages,
                                                Map<String, Object> options,
                                                String replayOfRecordId) {
        if (endpoint == null || !endpoint.isEnabled()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "指定的 AI 模型端点不可用");
        }
        try {
            return doChat(endpoint, purpose, messages, options, replayOfRecordId);
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
                                   Map<String, Object> options, String replayOfRecordId) throws Exception {
        AiModelProviderType type = e.getProviderType();
        if (!isOpenAiCompatible(type)) {
            log.warn("[ai-chat] provider unsupported purpose={} endpointId={} providerType={}",
                    purpose == null ? null : purpose.wire(), e.getId(), type == null ? null : type.wire());
            throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PROVIDER_NOT_SUPPORTED",
                    "providerType=" + type.wire() + " 暂未实现（ANTHROPIC / AZURE_OPENAI 需独立适配；其余走 OpenAI 兼容）");
        }
        String apiKey = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
        String model = resolveModel(e, options);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        if (options != null) {
            if (options.get("temperature") != null && !usesPlatformControlledSampling(model)) {
                body.put("temperature", options.get("temperature"));
            }
            if (options.get("max_tokens") != null) body.put("max_tokens", options.get("max_tokens"));
            if (options.get("top_p") != null) body.put("top_p", options.get("top_p"));
            // 聚算 Qwen 3.5 明确拒绝 response_format，须依靠 prompt 约束纯 JSON；其他端点照常透传。
            if (options.get("response_format") != null && !usesPlatformControlledSampling(model)) {
                body.put("response_format", options.get("response_format"));
            }
        }
        if (!body.containsKey("temperature") && e.getDefaultTemperature() != null
                && !usesPlatformControlledSampling(model)) {
            body.put("temperature", e.getDefaultTemperature());
        }
        if (!body.containsKey("max_tokens") && e.getDefaultMaxTokens() != null && e.getDefaultMaxTokens() > 0) {
            body.put("max_tokens", e.getDefaultMaxTokens());
        }
        if (!body.containsKey("top_p") && e.getDefaultTopP() != null) {
            body.put("top_p", e.getDefaultTopP());
        }
        clampQwen35OutputBudget(model, body);
        URI uri = URI.create(rstrip(e.getBaseUrl(), "/") + "/chat/completions");
        long startNanos = System.nanoTime();
        String requestId = "aic-" + UUID.randomUUID().toString().substring(0, 16);
        String requestJson = OM.writeValueAsString(body);
        try {
            guard.checkBeforeCall(e, guard.estimateChatTokens(messages, body));
        } catch (BusinessException ex) {
            usage.recordObserved(e.getId(), e.getName(), model,
                    purpose != null ? purpose.wire() : null, null, null, null, false,
                    requestId, null, elapsedMs(startNanos), ex.getCode(), ex.getMessage(),
                    requestJson, null, replayOfRecordId);
            throw ex;
        }
        log.info("[ai-chat] invoke start requestId={} purpose={} endpointId={} endpoint={} providerType={} model={} messages={} maxTokens={} jsonMode={}",
                requestId,
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
                ioLog.info("[ai-chat-io] REQUEST requestId={} purpose={} endpoint={} model={} messages={}",
                        requestId, purpose == null ? null : purpose.wire(), e.getName(), model, OM.writeValueAsString(messages));
            } catch (Exception ignore) { /* 序列化失败不阻塞主链路 */ }
        }
        HttpRequest req = HttpRequest.newBuilder(uri)
                .timeout(chatTimeout(options))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();
        // v0.85：发送 + 原始日志 + 非 2xx WARN + 失败用量统一走共享原语；token 解析仍留在本方法（见下）。
        ModelCallCtx ctx = ModelCallCtx.builder(purpose)
                .endpoint(e.getId(), e.getName())
                .model(model)
                .requestId(requestId)
                .requestBodyJson(requestJson)
                .replayOfRecordId(replayOfRecordId)
                .client(HTTP)
                .build();
        HttpResponse<String> resp;
        try {
            resp = upstreamHttp.sendJson(req, ctx);
        } catch (UpstreamCallException ex) {
            // 网络层异常：失败流水已由原语 best-effort 落库，这里只转成稳定业务错误码。
            String code = ex.isTimeout() ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_ERROR";
            String message = ex.isTimeout()
                    ? "AI 生成超时，请稍后重试或换一个模型端点"
                    : "AI 生成失败，请稍后重试";
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, code, message,
                    "endpoint=" + e.getName() + " purpose=" + (purpose == null ? null : purpose.wire())
                            + " model=" + model + " err=" + ex.getCause());
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            // 失败流水 + WARN 已由原语处理；不把上游响应体 / 端点名 / HTTP 状态直出给用户（脱敏），
            // 技术细节进 ErrorLog 供「追查号」排障。
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                    "AI 生成失败，请稍后重试",
                    "endpoint=" + e.getName() + " purpose=" + (purpose == null ? null : purpose.wire())
                            + " model=" + model + " status=" + resp.statusCode() + " body=" + snippet(resp.body()));
        }
        Map<?, ?> parsed;
        try {
            parsed = OM.readValue(resp.body(), Map.class);
        } catch (Exception parseEx) {
            // 2xx 但响应体无法解析：记原始响应（日志 + 流水），便于排查上游协议变化 / 网关插话。
            upstreamHttp.recordBadOutput(ctx, resp.body(), "AI_BAD_OUTPUT", elapsedMs(startNanos));
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "AI 返回无法解析，请稍后重试",
                    "endpoint=" + e.getName() + " status=" + resp.statusCode() + " body=" + snippet(resp.body()));
        }
        String upstreamId = parsed.get("id") != null ? String.valueOf(parsed.get("id")) : null;
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
            ioLog.info("[ai-chat-io] RESPONSE requestId={} upstreamId={} purpose={} model={} finish={} content={}",
                    requestId, upstreamId, purpose == null ? null : purpose.wire(), model, finishReason, content);
        }
        // v0.41：自建用量流水。best-effort，失败只 log，不阻断 chat 返回。
        usage.recordObserved(e.getId(), e.getName(), model,
                purpose != null ? purpose.wire() : null,
                promptTokens, completionTokens, tokensUsed, true,
                requestId, upstreamId, elapsedMs(startNanos), null, null,
                requestJson, resp.body(), replayOfRecordId);
        log.info("[ai-chat] invoke ok requestId={} upstreamId={} purpose={} endpointId={} endpoint={} model={} finish={} tokens={} promptTokens={} completionTokens={} contentLength={} durationMs={}",
                requestId,
                upstreamId,
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

    /**
     * 聚算 Qwen 3.5 chat 路由由平台托管采样参数；显式传 temperature 会被上游以 400 拒绝。
     * 该路由同时拒绝 response_format，JSON 只能由 prompt 约束；max_tokens 仍按 prompt 配置发送。
     */
    private static boolean usesPlatformControlledSampling(String model) {
        if (model == null) return false;
        String normalized = model.toLowerCase(Locale.ROOT);
        return normalized.contains("qwen3-5") || normalized.contains("qwen3.5");
    }

    /** 聚算 Qwen 3.5 路由的输出预算上限为 4096，是否传 response_format 都执行该限制。 */
    private static void clampQwen35OutputBudget(String model, Map<String, Object> body) {
        if (!usesPlatformControlledSampling(model)) return;
        Object configured = body.get("max_tokens");
        if (configured instanceof Number n && n.longValue() > 4096L) {
            body.put("max_tokens", 4096);
        }
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

    private Duration chatTimeout(Map<String, Object> options) {
        Object raw = options == null ? null : options.get("timeout_seconds");
        if (raw instanceof Number n) {
            return Duration.ofSeconds(clampTimeoutSeconds(n.longValue()));
        }
        if (raw != null) {
            try {
                return Duration.ofSeconds(clampTimeoutSeconds(Long.parseLong(String.valueOf(raw))));
            } catch (NumberFormatException ignore) {
                // 继续走全局默认值。
            }
        }
        return Duration.ofSeconds(clampTimeoutSeconds(chatTimeoutSeconds));
    }

    private static long clampTimeoutSeconds(long seconds) {
        return Math.max(10, Math.min(300, seconds));
    }

    private static String resolveModel(AiModelEndpoint e, Map<String, Object> options) {
        String requested = options != null && options.get("model") != null
                ? String.valueOf(options.get("model")).trim()
                : null;
        if (requested != null && !requested.isBlank()) {
            String alias = e.getModelAlias();
            if (alias != null && alias.equals(requested) && e.getModel() != null && !e.getModel().isBlank()) {
                return e.getModel();
            }
            return requested;
        }
        return e.getModel() != null && !e.getModel().isBlank() ? e.getModel() : "gpt-4o";
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
