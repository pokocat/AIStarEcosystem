package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.service.PromptService.ResolvedPrompt;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 素材运营「文本三件」接真 LLM 的薄层流水线（MATERIAL_OPS_AI_TEXT_PLAN §3/§5/§7）。
 *
 * 单轮「prompt 进 → 结构化 JSON 出」，无 agent / 多步 / 记忆：
 *   ① PromptService.resolve 取 system+user 模板（DB→resource→code）→ fill 业务参数
 *   ② AiModelInvocationService.invokeChat（按 purpose 选 provider + priority fallback）
 *   ③ 解析 JSON → 校验 → 不合法自修复重试 1 次 → 仍失败走占位兜底
 *
 * 永远可降级：provider 未配 / 调用失败 / JSON 解析失败 → 回退占位，HTTP 仍 200。
 */
@Service
public class MaterialAiService {

    private static final Logger log = LoggerFactory.getLogger(MaterialAiService.class);

    private static final Set<String> BLOCK_KINDS = Set.of("hook", "scene", "emotion", "product", "effect", "cta");
    private static final String[] PALETTE = {"#22b59a", "#f0a83a", "#ff5b8a", "#7c5cff", "#5b3fe0", "#ff8a5b"};

    /** 起稿时注入 prompt 的违禁词参考（server 端最小集；前端有更全的 BANNED_WORDS）。 */
    private static final List<String> BANNED_WORDS = List.of(
            "最", "第一", "唯一", "100%", "国家级", "根治", "药到病除", "永久", "绝对", "顶级");

    private final PromptService promptService;
    private final AiModelInvocationService invocation;
    private final ObjectMapper om;

    public MaterialAiService(PromptService promptService,
                             AiModelInvocationService invocation,
                             ObjectMapper om) {
        this.promptService = promptService;
        this.invocation = invocation;
        this.om = om;
    }

    // ── 卖点提取 ──────────────────────────────────────────────────────────────
    /** 返回「/」连接的卖点串；失败返回 null（调用方用 stub 兜底）。 */
    public String extractSellingPoints(String name, String link) {
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.SELLING_POINTS);
        Map<String, String> vars = Map.of("name", nz(name), "link", nz(link));
        String user = PromptService.fill(p.userTemplate(), vars);
        Optional<JsonNode> root = callJsonObject(AiModelPurpose.SELLING_POINTS, p, user);
        if (root.isPresent()) {
            JsonNode arr = root.get().get("selling_points");
            if (arr != null && arr.isArray() && arr.size() > 0) {
                List<String> pts = new ArrayList<>();
                arr.forEach(x -> {
                    String t = x.asText("").strip();
                    if (!t.isBlank()) pts.add(t);
                });
                if (!pts.isEmpty()) return String.join(" / ", pts);
            }
        }
        return null;
    }

    // ── 脚本 AI 起稿 ──────────────────────────────────────────────────────────
    /** 返回 ScriptAsset 形状的候选（非空；LLM 失败时回退内置占位池）。 */
    public List<JsonNode> draftScripts(Product product, String tone, List<String> audience,
                                       int durationSec, int count) {
        int n = Math.max(1, Math.min(count, 5));
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.SCRIPT_DRAFT);
        Map<String, String> vars = new HashMap<>();
        vars.put("product_name", nz(product.getName()));
        vars.put("category", nz(product.getCategory()));
        vars.put("price", product.getPriceCents() != null ? formatYuan(product.getPriceCents()) : "未知");
        vars.put("selling_points", nz(product.getSellingPoints()));
        vars.put("audience", (audience == null || audience.isEmpty()) ? "通用人群" : String.join("、", audience));
        vars.put("tone", nz(tone));
        vars.put("duration_sec", String.valueOf(durationSec > 0 ? durationSec : 38));
        vars.put("count", String.valueOf(n));
        vars.put("banned_words", String.join("、", BANNED_WORDS));
        String user = PromptService.fill(p.userTemplate(), vars);

        Optional<JsonNode> root = callJsonObject(AiModelPurpose.SCRIPT_DRAFT, p, user);
        List<JsonNode> out = new ArrayList<>();
        if (root.isPresent()) {
            JsonNode arr = root.get().get("scripts");
            if (arr != null && arr.isArray()) {
                int i = 0;
                for (JsonNode s : arr) {
                    JsonNode built = buildScriptAsset(s, product, audience, i);
                    if (built != null) {
                        out.add(built);
                        i++;
                    }
                    if (i >= n) break;
                }
            }
        }
        if (out.isEmpty()) {
            log.warn("[material-ai] script draft fell back to built-in pool (product={})", product.getId());
            return fallbackScripts(product, audience, n);
        }
        return out;
    }

    // ── 变量抽取 ──────────────────────────────────────────────────────────────
    /** 返回 ScriptVariable 形状（已过滤幻觉：原值须在脚本里出现）；可能为空 → 前端用正则兜底。 */
    public List<JsonNode> extractVariables(JsonNode blocks) {
        StringBuilder numbered = new StringBuilder();
        StringBuilder full = new StringBuilder();
        if (blocks != null && blocks.isArray()) {
            int i = 0;
            for (JsonNode b : blocks) {
                String text = b.path("text").asText("");
                numbered.append("镜").append(i).append("：").append(text).append('\n');
                full.append(text).append('\n');
                i++;
            }
        }
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.VARIABLE_EXTRACT);
        String user = PromptService.fill(p.userTemplate(), Map.of("script_blocks", numbered.toString()));
        Optional<JsonNode> root = callJsonObject(AiModelPurpose.VARIABLE_EXTRACT, p, user);
        List<JsonNode> out = new ArrayList<>();
        if (root.isPresent()) {
            JsonNode arr = root.get().get("variables");
            if (arr != null && arr.isArray()) {
                String scriptText = full.toString();
                int idx = 0;
                for (JsonNode v : arr) {
                    JsonNode built = buildVariable(v, scriptText, idx);
                    if (built != null) {
                        out.add(built);
                        idx++;
                    }
                }
            }
        }
        return out;
    }

    // ── LLM 调用 + 解析 + 自修复重试 ───────────────────────────────────────────

    private Optional<JsonNode> callJsonObject(AiModelPurpose purpose, ResolvedPrompt p, String user) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", p.system()));
        messages.add(Map.of("role", "user", "content", user));
        Map<String, Object> options = new HashMap<>();
        options.put("temperature", p.params().temperatureOrDefault());
        options.put("max_tokens", p.params().maxTokensOrDefault());
        if (p.params().jsonModeOrDefault()) {
            options.put("response_format", Map.of("type", "json_object"));
        }
        for (int attempt = 0; attempt < 2; attempt++) {
            String content;
            try {
                content = invocation.invokeChat(purpose, messages, options).content();
            } catch (Exception e) {
                // provider 未配 / 网络 / 5xx 全 fallback 失败 → 直接降级，不再重试
                log.warn("[material-ai] {} invoke failed: {}", purpose.wire(), e.getMessage());
                return Optional.empty();
            }
            String json = extractJson(content);
            try {
                JsonNode rootNode = json == null ? null : om.readTree(json);
                if (rootNode != null && rootNode.isObject()) return Optional.of(rootNode);
                throw new IllegalArgumentException("非 JSON 对象");
            } catch (Exception parseErr) {
                log.warn("[material-ai] {} parse failed (attempt {}): {} | body: {}",
                        purpose.wire(), attempt, parseErr.getMessage(), snippet(content));
                if (attempt == 0) {
                    messages = new ArrayList<>(messages);
                    messages.add(Map.of("role", "assistant", "content", content == null ? "" : content));
                    messages.add(Map.of("role", "user", "content",
                            "上次输出无法解析为 JSON 对象（错误：" + parseErr.getMessage()
                                    + "）。请严格只返回符合 schema 的 JSON 对象，不要任何额外文字或 markdown 代码块。"));
                }
            }
        }
        return Optional.empty();
    }

    /** 去掉 ```json``` 包裹 / 前后说明，截取首个 '{' 到末个 '}'。 */
    static String extractJson(String content) {
        if (content == null) return null;
        String s = content.strip();
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return s.substring(start, end + 1);
        return s;
    }

    // ── 后处理 / 校验 ──────────────────────────────────────────────────────────

    /** 校验并补全为完整 ScriptAsset；不合法返回 null（被丢弃）。 */
    private JsonNode buildScriptAsset(JsonNode raw, Product product, List<String> audience, int idx) {
        if (raw == null || !raw.isObject()) return null;
        JsonNode blocksIn = raw.get("blocks");
        if (blocksIn == null || !blocksIn.isArray() || blocksIn.size() < 3 || blocksIn.size() > 8) return null;

        ArrayNode blocks = om.createArrayNode();
        int totalDur = 0;
        for (JsonNode b : blocksIn) {
            String kind = b.path("kind").asText("").strip().toLowerCase();
            if (!BLOCK_KINDS.contains(kind)) kind = "scene";
            int dur = b.path("dur").asInt(0);
            if (dur <= 0) dur = 5;
            String text = b.path("text").asText("").strip();
            if (text.isBlank()) return null; // 空镜头 → 整稿作废
            ObjectNode block = om.createObjectNode();
            block.put("kind", kind);
            block.put("label", b.path("label").asText(defaultLabel(kind)));
            block.put("dur", dur);
            block.put("text", text);
            block.put("shot", b.path("shot").asText(""));
            blocks.add(block);
            totalDur += dur;
        }

        ObjectNode out = om.createObjectNode();
        out.put("id", "ai-" + Long.toString(System.nanoTime(), 36) + "-" + idx);
        out.put("kind", "ai_seed");
        out.put("name", raw.path("name").asText("AI 起稿 " + (idx + 1)));
        out.put("tier", normalizeTier(raw.path("tier").asText("B")));
        out.put("category", nz(product.getCategory()));
        out.put("hook_type", raw.path("hook_type").asText("情感"));
        ArrayNode aud = om.createArrayNode();
        if (audience != null) audience.forEach(aud::add);
        if (aud.size() == 0) aud.add("通用");
        out.set("audience", aud);
        ArrayNode platforms = om.createArrayNode();
        platforms.add("douyin");
        platforms.add("xhs");
        out.set("platforms", platforms);
        out.put("duration_sec", totalDur);
        out.set("blocks", blocks);
        // metrics 初值
        ObjectNode metrics = om.createObjectNode();
        metrics.put("uses_count", 0);
        metrics.put("ctr_pct", 0);
        metrics.put("diversity_pct", 0);
        metrics.put("completion_pct", 0);
        metrics.putNull("best_video");
        metrics.put("last_used_at", "—");
        out.set("metrics", metrics);
        // source
        ObjectNode source = om.createObjectNode();
        source.put("type", "ai");
        source.put("ref_id", "agent-v3");
        source.putNull("original_url");
        source.putNull("cloned_from");
        source.put("author", "智能体生成");
        out.set("source", source);
        // tags
        ArrayNode tags = om.createArrayNode();
        JsonNode tagsIn = raw.get("tags");
        if (tagsIn != null && tagsIn.isArray()) tagsIn.forEach(t -> tags.add(t.asText("")));
        out.set("tags", tags);
        out.put("cover_color", PALETTE[idx % PALETTE.length]);
        if (product.getId() != null) out.put("product_id", product.getId());
        return out;
    }

    /** 校验并补全为 ScriptVariable；原值须在脚本里出现，否则丢弃（过滤幻觉）。 */
    private JsonNode buildVariable(JsonNode raw, String scriptText, int idx) {
        if (raw == null || !raw.isObject()) return null;
        JsonNode valuesIn = raw.get("values");
        if (valuesIn == null || !valuesIn.isArray() || valuesIn.size() == 0) return null;
        String original = valuesIn.get(0).asText("").strip();
        if (original.isBlank() || !scriptText.contains(original)) return null; // 幻觉 / 非原文

        ObjectNode out = om.createObjectNode();
        out.put("id", raw.path("id").asText("var_" + idx));
        out.put("name", raw.path("name").asText("变量" + (idx + 1)));
        out.put("toneVar", PALETTE[idx % PALETTE.length]);
        ArrayNode values = om.createArrayNode();
        valuesIn.forEach(v -> {
            String t = v.asText("").strip();
            if (!t.isBlank()) values.add(t);
        });
        out.set("values", values);
        ArrayNode appearances = om.createArrayNode();
        JsonNode appIn = raw.get("appearances");
        if (appIn != null && appIn.isArray()) {
            for (JsonNode a : appIn) {
                ObjectNode ap = om.createObjectNode();
                ap.put("shot", a.path("shot").asInt(0));
                ap.put("phrase", a.path("phrase").asText(original));
                appearances.add(ap);
            }
        }
        out.set("appearances", appearances);
        ArrayNode suggestions = om.createArrayNode();
        JsonNode sugIn = raw.get("suggestions");
        if (sugIn != null && sugIn.isArray()) {
            sugIn.forEach(sx -> {
                String t = sx.asText("").strip();
                if (!t.isBlank()) suggestions.add(t);
            });
        }
        out.set("suggestions", suggestions);
        return out;
    }

    // ── 内置占位池（LLM 不可用时的脚本兜底） ─────────────────────────────────────

    private List<JsonNode> fallbackScripts(Product product, List<String> audience, int n) {
        String pn = nz(product.getName());
        record T(String name, String tier, String hook, String[] tags, String[][] blocks) {}
        List<T> pool = List.of(
                new T("蓝领情感 · 真实生活", "A", "情感", new String[]{"情感", "送礼"}, new String[][]{
                        {"hook", "黄金 3s 钩子", "3", "干了一辈子活，第一次给家里人买" + pn, "油污大手特写"},
                        {"emotion", "情感铺垫", "9", "收工回家 · 家人在沙发上揉肩", "跟拍"},
                        {"product", "产品揭示", "12", "默默拿出" + pn + " · 家人惊讶反应", "怼镜特写"},
                        {"effect", "效果体验", "10", "家人边用边说舒服 · 笑出声", "双人对坐"},
                        {"cta", "行动召唤", "6", "有需要的姐妹评论区扣 1", "CTA 字幕"},
                }),
                new T("产品测评 · 理性种草", "B", "测评", new String[]{"测评", "性价比"}, new String[][]{
                        {"hook", "黄金 3s 钩子", "4", "同价位测了好几款 · " + pn + "是我留下的那个", "测评台特写"},
                        {"product", "产品解构", "12", "拆开看做工 · 标注关键参数", "微距 + 拆解"},
                        {"effect", "体感测评", "10", "真人实测体验 · 记录使用感受", "数据可视化"},
                        {"scene", "横向对比", "6", "几款竞品同台对比 · 价格 vs 体感", "对比表格"},
                        {"cta", "行动召唤", "4", "理性党直接抄作业 · 链接置顶", "CTA 徽章"},
                }),
                new T("场景剧情 · 反差揭示", "A", "剧情", new String[]{"剧情", "反差"}, new String[][]{
                        {"hook", "黄金 3s 钩子", "3", "本来没抱期待 · 用了" + pn + "之后真香", "手机屏幕特写"},
                        {"scene", "场景铺垫", "8", "日常场景 · 痛点自然带出", "生活 vlog"},
                        {"product", "产品揭示", "11", "拆开" + pn + " · 第一反应", "拆箱反应"},
                        {"effect", "效果体验", "10", "前后对比 · 直观可感", "量化字幕"},
                        {"cta", "行动召唤", "5", "今天还有活动 · 错过等下次", "紧迫挂车"},
                })
        );
        List<JsonNode> out = new ArrayList<>();
        for (int i = 0; i < n && i < pool.size(); i++) {
            T t = pool.get(i);
            ObjectNode raw = om.createObjectNode();
            raw.put("name", t.name());
            raw.put("tier", t.tier());
            raw.put("hook_type", t.hook());
            ArrayNode tags = om.createArrayNode();
            for (String tag : t.tags()) tags.add(tag);
            raw.set("tags", tags);
            ArrayNode blocks = om.createArrayNode();
            for (String[] b : t.blocks()) {
                ObjectNode bn = om.createObjectNode();
                bn.put("kind", b[0]);
                bn.put("label", b[1]);
                bn.put("dur", Integer.parseInt(b[2]));
                bn.put("text", b[3]);
                bn.put("shot", b[4]);
                blocks.add(bn);
            }
            raw.set("blocks", blocks);
            JsonNode built = buildScriptAsset(raw, product, audience, i);
            if (built != null) out.add(built);
        }
        return out;
    }

    // ── 杂项 ──────────────────────────────────────────────────────────────────

    private static String defaultLabel(String kind) {
        return switch (kind) {
            case "hook" -> "黄金 3s 钩子";
            case "emotion" -> "情感铺垫";
            case "product" -> "产品揭示";
            case "effect" -> "效果体验";
            case "cta" -> "行动召唤";
            default -> "场景铺垫";
        };
    }

    private static String normalizeTier(String t) {
        String u = t == null ? "" : t.strip().toUpperCase();
        return switch (u) {
            case "S", "A", "B", "D" -> u;
            default -> "B";
        };
    }

    private static String formatYuan(int cents) {
        return "¥" + String.format("%.2f", cents / 100.0);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String snippet(String s) {
        if (s == null) return "";
        return s.length() > 240 ? s.substring(0, 240) : s;
    }
}
