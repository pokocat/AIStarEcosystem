package com.aistareco.aep.service;

import com.aistareco.aep.dto.ForgeCozeChatRequest;
import com.aistareco.aep.dto.ForgeProviderStatusDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;

/**
 * 形象锻造对话编排（v0.43+）。
 *
 * 把 v3 形象锻造从「只能走 Coze agent」升级为「优先走平台大模型（{@link AiModelInvocationService}），
 * Coze 作为可选回退」的混合通道。music / drama 两个子产品共用本服务（按 artistId 校验归属）。
 *
 * 选路：
 *   1. 已为 {@link AiModelPurpose#APPEARANCE_FORGE} 绑定可用端点 → 走大模型（prompt 模板可在后台配置）。
 *   2. 否则若 Coze 已配置（后台 Agent 平台 / env）→ 走 Coze（保留原 agent 能力）。
 *   3. 都没有 → 抛 503，并给出明确的「去后台配置」提示。
 *
 * 大模型路径用一次性 {@code invokeChat} 拿到完整方案，再在服务端按字切片成 SSE delta，
 * 让前端获得逐字流式的体验（真实调用 + 服务端切流）。
 */
@Service
public class ForgeChatService {

    private static final Logger log = LoggerFactory.getLogger(ForgeChatService.class);

    /** 服务端切流的单片字符数 + 片间隔（毫秒），仅影响“打字机”观感。 */
    private static final int CHUNK_SIZE = 24;
    private static final long CHUNK_DELAY_MS = 28L;

    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final ForgeCozeService forgeCozeService;
    private final DigitalIpRepository digitalIpRepo;

    public ForgeChatService(AiModelInvocationService invocation,
                            PromptService promptService,
                            ForgeCozeService forgeCozeService,
                            DigitalIpRepository digitalIpRepo) {
        this.invocation = invocation;
        this.promptService = promptService;
        this.forgeCozeService = forgeCozeService;
        this.digitalIpRepo = digitalIpRepo;
    }

    /** 当前形象锻造对话的可用通道状态（前端据此决定能否直接发起）。 */
    public ForgeProviderStatusDto status() {
        if (invocation.hasEndpointFor(AiModelPurpose.APPEARANCE_FORGE)) {
            return new ForgeProviderStatusDto(true, "llm",
                    "已接入平台大模型，可直接开始形象锻造对话");
        }
        // 回退到 Coze 的状态（含其自身的「已配置 / 未配置」文案）。
        ForgeProviderStatusDto cozeStatus = forgeCozeService.status();
        if (cozeStatus.configured()) {
            return cozeStatus;
        }
        return new ForgeProviderStatusDto(false, "none",
                "形象锻造还没接入大模型：请在管理后台「平台与配置 → AI 模型与 Key」里，"
                        + "为「形象锻造对话」用途绑定一个可用的模型端点后再试。");
    }

    /**
     * 发起一次形象锻造对话流。事件通过 sink 回调（与 ForgeCozeService 同签名，便于 controller 复用）。
     */
    public void streamConversation(String requestId,
                                   String ownerUserId,
                                   ForgeCozeChatRequest request,
                                   BiConsumer<String, Map<String, Object>> sink) {
        // 归属校验：artist 存在且不属于当前用户 → 403；不存在则放行（仅做一次大模型问答，不泄漏数据）。
        verifyArtistOwnership(request.artistId(), ownerUserId);

        if (invocation.hasEndpointFor(AiModelPurpose.APPEARANCE_FORGE)) {
            streamViaLlm(requestId, ownerUserId, request, sink);
            return;
        }
        if (forgeCozeService.status().configured()) {
            log.info("Forge chat falling back to Coze: requestId={}", requestId);
            forgeCozeService.streamConversation(requestId, ownerUserId, request, sink);
            return;
        }
        throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "FORGE_NOT_CONFIGURED",
                "形象锻造还没接入大模型，暂时无法生成方案。请联系管理员在后台为「形象锻造对话」用途绑定模型端点。");
    }

    // ── 大模型路径 ───────────────────────────────────────────────────────────────

    private void streamViaLlm(String requestId,
                              String ownerUserId,
                              ForgeCozeChatRequest request,
                              BiConsumer<String, Map<String, Object>> sink) {
        sink.accept("status", payload("phase", "validated", "message", "已连接平台大模型，开始生成形象方案"));

        PromptService.ResolvedPrompt prompt = promptService.resolve(AiModelPurpose.APPEARANCE_FORGE);
        String userContent = PromptService.fill(prompt.userTemplate(), Map.of("input", request.prompt() == null ? "" : request.prompt()));

        List<Map<String, String>> messages = new ArrayList<>();
        if (prompt.system() != null && !prompt.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", prompt.system()));
        }
        messages.add(Map.of("role", "user", "content", userContent));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", prompt.params().temperature() != null ? prompt.params().temperature() : 0.85);
        options.put("max_tokens", prompt.params().maxTokens() != null && prompt.params().maxTokens() > 0
                ? prompt.params().maxTokens() : 2048);
        // 形象方案是自由中文文本，不用 JSON 模式（否则模型会被逼成 JSON 结构）。

        sink.accept("status", payload("phase", "in_progress", "message", "大模型正在生成形象方案"));

        AiModelInvocationService.AiModelResponse resp = invocation.invokeChat(
                AiModelPurpose.APPEARANCE_FORGE, messages, options);
        String content = resp.content() == null ? "" : resp.content().trim();
        if (content.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "FORGE_EMPTY_OUTPUT",
                    "大模型这次没有返回有效内容，请稍后重试或调整你的描述。");
        }

        log.info("Forge chat via LLM done: requestId={}, ownerUserId={}, model={}, endpoint={}, tokens={}, contentLength={}",
                requestId, ownerUserId, resp.modelUsed(), resp.endpointUsed(), resp.tokensUsed(), content.length());

        // 服务端切流：逐片 emit delta（打字机观感）。
        StringBuilder assembled = new StringBuilder();
        for (int i = 0; i < content.length(); i += CHUNK_SIZE) {
            String chunk = content.substring(i, Math.min(content.length(), i + CHUNK_SIZE));
            assembled.append(chunk);
            sink.accept("delta", payload("content", chunk, "reply", assembled.toString()));
            sleep(CHUNK_DELAY_MS);
        }

        sink.accept("message", payload("content", content));
        Map<String, Object> completed = new LinkedHashMap<>();
        completed.put("phase", "completed");
        completed.put("message", "形象方案生成完成");
        completed.put("content", content);
        if (resp.tokensUsed() != null) completed.put("tokenCount", resp.tokensUsed());
        sink.accept("completed", completed);
    }

    // ── 工具 ──────────────────────────────────────────────────────────────────

    private void verifyArtistOwnership(String artistId, String ownerUserId) {
        if (artistId == null || artistId.isBlank()) return;
        DigitalIp ip = digitalIpRepo.findById(artistId).orElse(null);
        if (ip == null) return; // 不在 DigitalIp 表（如 mock / 其它实体）→ 仅做问答，不校验
        if (ip.getOwnerUserId() != null && !ip.getOwnerUserId().equals(ownerUserId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "ARTIST_FORBIDDEN",
                    "你没有这个艺人的操作权限。");
        }
    }

    private static Map<String, Object> payload(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
