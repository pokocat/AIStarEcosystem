package com.aistareco.aep.card.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 名片「人设」的 AI 对话与改写。
 *
 * <p>为什么名片要有人设：名片上那些字段（职位 / 城市 / 作品）说的是**他做过什么**，
 * 而见了面真正记住一个人靠的是**他是谁** —— 在意什么、怎么说话。这一层就是后者。
 *
 * <p>它不是装饰性的简介：`voice` 是**说话方式的规格**，改写文案（{@link #rewrite})
 * 按它来写，将来数字人开口也按它来。所以人设改了，名片的说法会跟着变。
 *
 * <p><b>用途复用 {@link AiModelPurpose#DAP_PERSONA}</b>（「数字人 · 人设/翻译」）——
 * 语义完全对得上，不新增枚举、不加迁移，运营在后台已经能给它绑端点。
 *
 * <p><b>§8.0：不配置就报错，绝不用模板凑答案。</b>端点没绑 → 503 AI_NOT_CONFIGURED；
 * 提示词回落到 code → 503 PROMPT_NOT_CONFIGURED；模型返回的不是 JSON → 502 AI_BAD_OUTPUT。
 * 人设是要写进对外名片的东西，用一段套话冒充「AI 给你梳理的」比不给更糟。
 */
@Service
public class CardPersonaService {

    private static final Logger log = LoggerFactory.getLogger(CardPersonaService.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    /** 对话轮数上限：再多也问不出新东西，只会烧 token。 */
    private static final int MAX_HISTORY = 24;

    private final AiModelInvocationService invocation;
    private final PromptService promptService;

    public CardPersonaService(AiModelInvocationService invocation, PromptService promptService) {
        this.invocation = invocation;
        this.promptService = promptService;
    }

    /** 一轮对话：把上下文与历史交给模型，拿回「下一句话 + 可能的人设草稿」。 */
    public JsonNode chat(Map<String, Object> context, List<Map<String, String>> history, String userMessage) {
        requireEngine();
        PromptService.ResolvedPrompt p = requirePrompt("card.persona_chat");

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("name", str(context.get("name")));
        vars.put("title", str(context.get("title")));
        vars.put("city", str(context.get("city")));
        vars.put("headline", str(context.get("headline")));
        vars.put("give", str(context.get("give")));
        vars.put("want", str(context.get("want")));
        vars.put("persona", str(context.get("persona")));
        vars.put("userMessage", userMessage == null ? "" : userMessage);

        List<Map<String, String>> messages = new ArrayList<>();
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", PromptService.fill(p.system(), vars)));
        }
        // 历史原样带上 —— 顾问要能追问，没有上下文就只会一遍遍问同样的问题
        if (history != null) {
            for (Map<String, String> m : history.subList(Math.max(0, history.size() - MAX_HISTORY), history.size())) {
                String role = "assistant".equals(m.get("role")) ? "assistant" : "user";
                String content = m.get("content");
                if (content != null && !content.isBlank()) messages.add(Map.of("role", role, "content", content));
            }
        }
        messages.add(Map.of("role", "user", "content", PromptService.fill(p.userTemplate(), vars)));
        return callJson(p, messages, 0.85);
    }

    /** 按已定的人设重写名片上访客看得见的几句（只改说法，不改事实）。 */
    public JsonNode rewrite(Map<String, Object> context) {
        requireEngine();
        PromptService.ResolvedPrompt p = requirePrompt("card.persona_rewrite");

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("persona", str(context.get("persona")));
        vars.put("headline", str(context.get("headline")));
        vars.put("title", str(context.get("title")));
        vars.put("give", str(context.get("give")));
        vars.put("want", str(context.get("want")));

        List<Map<String, String>> messages = new ArrayList<>();
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", PromptService.fill(p.system(), vars)));
        }
        messages.add(Map.of("role", "user", "content", PromptService.fill(p.userTemplate(), vars)));
        return callJson(p, messages, 0.7);
    }

    // ── 内部 ────────────────────────────────────────────────────────────────

    private void requireEngine() {
        if (!invocation.hasEndpointFor(AiModelPurpose.DAP_PERSONA)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "人设对话还没接入大模型：请在管理后台把「数字人 · 人设/翻译」用途绑定一个模型端点后再试。");
        }
    }

    private PromptService.ResolvedPrompt requirePrompt(String key) {
        PromptService.ResolvedPrompt p = promptService.resolve(key);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "人设提示词尚未配置（promptKey=" + key + "），请在管理后台补全后再试。");
        }
        return p;
    }

    private JsonNode callJson(PromptService.ResolvedPrompt p, List<Map<String, String>> messages, double defaultTemp) {
        double temperature = p.params().temperature() != null ? p.params().temperature() : defaultTemp;
        int maxTokens = p.params().maxTokens() != null && p.params().maxTokens() > 0 ? p.params().maxTokens() : 1536;
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", temperature);
        options.put("max_tokens", maxTokens);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse res;
        try {
            res = invocation.invokeChat(AiModelPurpose.DAP_PERSONA, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("[card-persona] 调用失败", e);
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "人设对话调用失败，请稍后重试。");
        }
        JsonNode root = tryReadJson(res.content());
        if (root == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "AI 返回的内容无法解析，请重试。");
        }
        return root;
    }

    /** 模型偶尔会用 ```json 包起来 —— 剥掉再解析，解析不了就返回 null 由调用方报错。 */
    private static JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String t = content.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) t = t.substring(nl + 1);
            if (t.endsWith("```")) t = t.substring(0, t.length() - 3);
            t = t.trim();
        }
        try {
            return mapper.readTree(t);
        } catch (Exception e) {
            return null;
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
    }
}
