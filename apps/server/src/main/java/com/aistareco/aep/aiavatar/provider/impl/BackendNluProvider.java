package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.ProviderHealth;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.Map;

/**
 * 人设文案解析 **真实**实现（nlu）—— 走平台大模型网关（{@link AiModelInvocationService}）。
 * 任务书 §0/§4：「后端已有 LLM 网关」，描述词→结构化人设走真实大模型。
 *
 * v0.46+: system prompt 不再硬编码，改由 {@link PromptService} 按 key=aiavatar.nlu.persona 解析
 * （DB→resource .md→code 兜底），运营可在 web-aiavatar /config 改写。PromptService 不可用时
 * 退回内置兜底文案（行为与旧版一致）。
 *
 * 网关未配置对应用途端点时 healthcheck=false；registry 在 dev 回退 mock，prod 抛错可见。
 */
public class BackendNluProvider extends AbstractCapabilityProvider {

    private static final String FALLBACK_SYS =
            "你是AiAvatar形象策划。把用户的人设描述抽取为结构化 JSON，"
            + "字段：appearance(外貌)、temperament(气质)、style(风格)、scene(适用场景)、"
            + "keywords(关键词数组)、summary(一句话总结)。只输出 JSON，不要多余文字。";

    private final AiModelInvocationService gateway;
    private final PromptService promptService;

    public BackendNluProvider(AiModelInvocationService gateway, AiAvatarStorage storage, ObjectMapper mapper,
                              PromptService promptService) {
        super(AiAvatarCapability.NLU, AiAvatarProviderMode.BACKEND, "LLM-Gateway", storage, mapper);
        this.gateway = gateway;
        this.promptService = promptService;
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) throws Exception {
        if (gateway == null || !gateway.hasEndpointFor(AiModelPurpose.GENERAL)) {
            throw new IllegalStateException("AI_NOT_CONFIGURED: 未配置可用大模型端点（用途=GENERAL）");
        }
        String prompt = strVal(input, "prompt", "");
        ctx.onProgress(20, "调用大模型解析人设");

        // 运营可配 prompt（key=aiavatar.nlu.persona）；不可用时退回内置兜底。
        String sys = FALLBACK_SYS;
        String userContent = prompt;
        if (promptService != null) {
            PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_AIAVATAR_NLU_PERSONA);
            if (p.system() != null && !p.system().isBlank()) sys = p.system();
            if (p.userTemplate() != null && !p.userTemplate().isBlank()) {
                userContent = PromptService.fill(p.userTemplate(), Map.of("input", prompt));
            }
        }
        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", sys),
                Map.of("role", "user", "content", userContent)
        );

        Object resp = gateway.invokeChat(AiModelPurpose.GENERAL, messages, Map.of("response_format", "json_object"));
        ctx.onProgress(80, "解析返回");
        String content = extractContent(resp);

        JsonNode parsed = tryParse(content);
        if (parsed == null) {
            ObjectNode r = mapper.createObjectNode();
            r.put("summary", content == null ? "" : content);
            r.put("engine", "LLM-Gateway");
            parsed = r;
        } else if (parsed.isObject()) {
            ((ObjectNode) parsed).put("engine", "LLM-Gateway");
        }
        return ProviderResult.meta(parsed.toString());
    }

    /** 防御性提取响应文本（不依赖 AiModelResponse record 的精确字段名）。 */
    private String extractContent(Object resp) {
        if (resp == null) return null;
        if (resp instanceof String s) return s;
        JsonNode node = mapper.valueToTree(resp);
        for (String key : new String[]{"content", "text", "reply", "message", "output"}) {
            if (node.hasNonNull(key)) return node.get(key).asText();
        }
        return node.toString();
    }

    private JsonNode tryParse(String content) {
        if (content == null || content.isBlank()) return null;
        String c = content.trim();
        int i = c.indexOf('{'), j = c.lastIndexOf('}');
        if (i >= 0 && j > i) c = c.substring(i, j + 1);
        try {
            return mapper.readTree(c);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public ProviderHealth healthcheck() {
        boolean ok = gateway != null && gateway.hasEndpointFor(AiModelPurpose.GENERAL);
        return ok ? ProviderHealth.ok("LLM gateway bound") : ProviderHealth.down("无可用大模型端点(GENERAL)");
    }
}
