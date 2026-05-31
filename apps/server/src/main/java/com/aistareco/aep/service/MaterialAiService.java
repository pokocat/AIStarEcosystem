package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.Product;
import com.aistareco.aep.service.PromptService.ResolvedPrompt;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 素材运营「文本三件」接真 LLM 的薄层流水线（MATERIAL_OPS_AI_TEXT_PLAN §3/§5/§7）。
 *
 * 单轮「prompt 进 → 结构化 JSON 出」，无 agent / 多步 / 记忆：
 *   ① 校验配置：无该用途的启用 provider / prompt 未配置 → 抛 BusinessException（明确提示去哪配）
 *   ② PromptService.resolve 取 system+user 模板（DB→resource→code）→ fill 业务参数
 *   ③ AiModelInvocationService.invokeChat（按 purpose 选唯一绑定端点，无 fallback）
 *   ④ 解析 JSON → 校验 → 不合法自修复重试 1 次 → 仍失败抛 AI_BAD_OUTPUT
 *
 * 不静默兜底：配置/调用/解析问题一律抛出带 code 的错误（AI_NOT_CONFIGURED /
 * PROMPT_NOT_CONFIGURED / AI_CALL_FAILED / AI_BAD_OUTPUT），上层透传到前端明确展示，
 * 便于定位「token 未配 / prompt 未配 / 模型不行」等配置问题。
 * （USE_MOCK 前端模式根本不打后端，自有本地占位池/正则，与此无关。）
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
    /** 返回「/」连接的卖点串；配置/调用/解析问题抛 BusinessException（不兜底）。 */
    public String extractSellingPoints(String name, String link) {
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.SELLING_POINTS);
        ensureConfigured(AiModelPurpose.SELLING_POINTS, p);
        Map<String, String> vars = Map.of("name", nz(name), "link", nz(link));
        String user = PromptService.fill(p.userTemplate(), vars);
        JsonNode root = callJsonObject(AiModelPurpose.SELLING_POINTS, p, user);
        JsonNode arr = root.get("selling_points");
        if (arr != null && arr.isArray() && arr.size() > 0) {
            List<String> pts = new ArrayList<>();
            arr.forEach(x -> {
                String t = x.asText("").strip();
                if (!t.isBlank()) pts.add(t);
            });
            if (!pts.isEmpty()) return String.join(" / ", pts);
        }
        throw badOutput(AiModelPurpose.SELLING_POINTS, "未产出有效卖点");
    }

    // ── 脚本 AI 起稿 ──────────────────────────────────────────────────────────
    /** 返回 ScriptAsset 形状的候选；配置/调用/解析问题抛 BusinessException（不兜底）。 */
    public List<JsonNode> draftScripts(Product product, String tone, List<String> audience,
                                       int durationSec, int count) {
        int n = Math.max(1, Math.min(count, 5));
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.SCRIPT_DRAFT);
        ensureConfigured(AiModelPurpose.SCRIPT_DRAFT, p);
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

        JsonNode root = callJsonObject(AiModelPurpose.SCRIPT_DRAFT, p, user);
        List<JsonNode> out = new ArrayList<>();
        JsonNode arr = root.get("scripts");
        int seen = 0;
        if (arr != null && arr.isArray()) {
            for (JsonNode s : arr) {
                seen++;
                JsonNode built;
                try {
                    built = buildScriptAsset(s, product, audience, out.size());
                } catch (Exception e) {
                    log.warn("[material-ai] SCRIPT_DRAFT 第 {} 个候选构造失败，跳过：{}", seen, e.getMessage());
                    continue;
                }
                if (built != null) out.add(built);
                if (out.size() >= n) break;
            }
        }
        log.info("[material-ai] SCRIPT_DRAFT 产出 {} 条有效脚本（模型返回 {} 条，请求 {} 条）", out.size(), seen, n);
        if (out.isEmpty()) {
            throw badOutput(AiModelPurpose.SCRIPT_DRAFT, "未产出有效脚本（镜头数/字段校验后为空，模型返回 " + seen + " 条）");
        }
        return out;
    }

    // ── 变量抽取 ──────────────────────────────────────────────────────────────
    /**
     * 返回 ScriptVariable 形状（已过滤幻觉：原值须在脚本里出现）。
     * 配置/调用/解析问题抛 BusinessException（前端 catch 后给警示、保留正则结果）。
     * 空列表是合法结果（模型确实没找到可替换变量），不视为错误。
     */
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
        ensureConfigured(AiModelPurpose.VARIABLE_EXTRACT, p);
        String user = PromptService.fill(p.userTemplate(), Map.of("script_blocks", numbered.toString()));
        JsonNode root = callJsonObject(AiModelPurpose.VARIABLE_EXTRACT, p, user);
        List<JsonNode> out = new ArrayList<>();
        JsonNode arr = root.get("variables");
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
        return out;
    }

    // ── 爆款链接分析 ──────────────────────────────────────────────────────────
    /** 用户主动提交单条链接后，按 VIDEO_REF_ANALYSIS prompt 产出 ViralHit 形状。 */
    public JsonNode analyzeViralLink(String sourceUrl, String videoUrl, String platform, String titleHint) {
        ResolvedPrompt p = promptService.resolve(AiModelPurpose.VIDEO_REF_ANALYSIS);
        ensureConfigured(AiModelPurpose.VIDEO_REF_ANALYSIS, p);
        Map<String, String> vars = new HashMap<>();
        vars.put("source_url", nz(sourceUrl));
        vars.put("video_url", nz(videoUrl));
        vars.put("platform", nz(platform));
        vars.put("title_hint", nz(titleHint));
        String user = PromptService.fill(p.userTemplate(), vars);
        JsonNode root = callJsonObject(AiModelPurpose.VIDEO_REF_ANALYSIS, p, user);
        JsonNode built = buildViralHit(root, platform, sourceUrl, videoUrl, titleHint);
        if (built == null) {
            throw badOutput(AiModelPurpose.VIDEO_REF_ANALYSIS, "未产出有效爆款拆解");
        }
        return built;
    }

    // ── 配置校验（不静默兜底，给明确提示） ──────────────────────────────────────

    private void ensureConfigured(AiModelPurpose purpose, ResolvedPrompt p) {
        String key = PromptService.promptKeyFor(purpose);
        if (!invocation.hasEndpointFor(purpose)) {
            log.warn("[material-ai] {} key={} 阻断：未绑定可用 AI 模型端点", purpose.wire(), key);
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "未为「" + purposeLabel(purpose) + "」绑定 AI 模型端点（promptKey=" + key + "）。请到 管理后台 → "
                            + "平台与配置 → AI 模型与 Key → 「AI 应用绑定」为该用途选择一个端点（端点需含有效上游密钥）。");
        }
        if ("code".equals(p.origin())) {
            log.warn("[material-ai] {} key={} 阻断：prompt 仅命中代码兜底（DB/resource 均无）", purpose.wire(), key);
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "「" + purposeLabel(purpose) + "」的 Prompt 模板缺失（promptKey=" + key + "）。请到 管理后台 → "
                            + "平台与配置 → Prompt 管理 检查。");
        }
    }

    // ── LLM 调用 + 解析 + 自修复重试（失败抛 BusinessException） ──────────────────

    private JsonNode callJsonObject(AiModelPurpose purpose, ResolvedPrompt p, String user) {
        String key = PromptService.promptKeyFor(purpose);
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", p.system()));
        messages.add(Map.of("role", "user", "content", user));
        Map<String, Object> options = new HashMap<>();
        options.put("temperature", p.params().temperatureOrDefault());
        options.put("max_tokens", p.params().maxTokensOrDefault());
        boolean jsonMode = p.params().jsonModeOrDefault();
        if (jsonMode) options.put("response_format", Map.of("type", "json_object"));
        log.info("[material-ai] {} key={} origin={} 开始调用 · temp={} maxTokens={} jsonMode={}",
                purpose.wire(), key, p.origin(), p.params().temperatureOrDefault(),
                p.params().maxTokensOrDefault(), jsonMode);

        String lastParseErr = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            AiModelInvocationService.AiModelResponse resp;
            try {
                resp = invocation.invokeChat(purpose, messages, options);
            } catch (BusinessException be) {
                String hint = (be.getStatus() == HttpStatus.UNAUTHORIZED || be.getStatus() == HttpStatus.FORBIDDEN)
                        ? "（API Key 可能无效或无权限，请检查 AI 模型配置）" : "";
                log.warn("[material-ai] {} key={} invoke 失败(attempt {}): status={} {}",
                        purpose.wire(), key, attempt, be.getStatus(), be.getMessage());
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                        "大模型调用失败（" + purposeLabel(purpose) + "，promptKey=" + key + "）" + hint + "：" + be.getMessage());
            } catch (Exception e) {
                log.warn("[material-ai] {} key={} invoke 异常(attempt {}): {}",
                        purpose.wire(), key, attempt, e.toString());
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                        "大模型调用失败（" + purposeLabel(purpose) + "，promptKey=" + key + "）：" + e.getMessage());
            }
            String content = resp.content();
            log.info("[material-ai] {} key={} 收到响应(attempt {}) · endpoint={} model={} finish={} tokens={} len={}",
                    purpose.wire(), key, attempt, resp.endpointUsed(), resp.modelUsed(),
                    resp.finishReason(), resp.tokensUsed(), content == null ? 0 : content.length());
            // finish_reason=length 说明被 max_tokens 截断 → JSON 极可能不完整
            if ("length".equalsIgnoreCase(resp.finishReason())) {
                log.warn("[material-ai] {} key={} 输出被 max_tokens 截断（finish=length）→ JSON 可能不完整，建议调大 maxTokens 或减少生成条数",
                        purpose.wire(), key);
            }
            String json = extractJson(content);
            try {
                JsonNode rootNode = json == null ? null : om.readTree(json);
                if (rootNode != null && rootNode.isObject()) {
                    log.info("[material-ai] {} key={} 解析成功(attempt {})", purpose.wire(), key, attempt);
                    return rootNode;
                }
                throw new IllegalArgumentException("非 JSON 对象");
            } catch (Exception parseErr) {
                lastParseErr = parseErr.getMessage();
                log.warn("[material-ai] {} key={} 解析失败(attempt {}): {} | body[:1000]={}",
                        purpose.wire(), key, attempt, parseErr.getMessage(), snippet(content));
                if (attempt == 0) {
                    messages = new ArrayList<>(messages);
                    messages.add(Map.of("role", "assistant", "content", content == null ? "" : content));
                    messages.add(Map.of("role", "user", "content",
                            "上次输出无法解析为 JSON 对象（错误：" + parseErr.getMessage()
                                    + "）。请严格只返回符合 schema 的 JSON 对象，不要任何额外文字或 markdown 代码块。"));
                }
            }
        }
        throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                "大模型输出无法解析为有效 JSON（promptKey=" + key + "，已重试 1 次）。"
                        + "请检查所选模型是否支持 JSON 输出，或调整 Prompt。错误：" + lastParseErr);
    }

    private BusinessException badOutput(AiModelPurpose purpose, String why) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                "大模型（" + purposeLabel(purpose) + "）" + why + "。请重试，或到 Prompt 管理 调整模板。");
    }

    private static String purposeLabel(AiModelPurpose purpose) {
        return switch (purpose) {
            case SCRIPT_DRAFT -> "脚本起草";
            case SELLING_POINTS -> "卖点提取";
            case VARIABLE_EXTRACT -> "变量抽取";
            case VIDEO_REF_ANALYSIS -> "视频参考分析";
            default -> purpose.wire();
        };
    }

    /** 去掉 ```json``` 包裹 / 前后说明，截取首个 '{' 到末个 '}'。 */
    static String extractJson(String content) {
        if (content == null) return null;
        String s = content.strip();
        // 去 markdown 代码围栏（```json ... ``` / ``` ... ```）
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) s = s.substring(nl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.strip();
        }
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

    /** 校验并补全为 ViralHit。 */
    private JsonNode buildViralHit(JsonNode raw, String platformHint, String sourceUrl, String videoUrl, String titleHint) {
        if (raw == null || !raw.isObject()) return null;
        ObjectNode out = om.createObjectNode();
        String platform = normalizePlatform(raw.path("platform").asText(platformHint));
        String title = raw.path("title").asText("").strip();
        if (title.isBlank()) title = titleHint == null || titleHint.isBlank() ? "链接解析视频" : titleHint;
        String cat = raw.path("cat").asText("日用百货").strip();
        out.put("platform", platform);
        out.put("plays", raw.path("plays").asText("0"));
        out.put("likes", raw.path("likes").asText("0"));
        out.put("author", raw.path("author").asText("链接解析"));
        out.put("title", title);
        out.put("cat", cat.isBlank() ? "日用百货" : cat);
        out.put("cat_color", categoryColor(cat));
        out.put("duration", clamp(raw.path("duration").asInt(10), 5, 180));
        out.put("postedAt", "刚刚");
        out.put("hook", raw.path("hook").asText(title));

        ArrayNode structure = om.createArrayNode();
        JsonNode structureIn = raw.get("structure");
        if (structureIn != null && structureIn.isArray()) {
            for (JsonNode s : structureIn) {
                String text = s.path("text").asText("").strip();
                if (text.isBlank()) continue;
                ObjectNode shot = om.createObjectNode();
                shot.put("t", s.path("t").asText((structure.size() * 2) + "-" + ((structure.size() + 1) * 2) + "s"));
                shot.put("label", s.path("label").asText("镜头" + (structure.size() + 1)));
                shot.put("text", text);
                shot.put("tag", s.path("tag").asText("分析"));
                structure.add(shot);
                if (structure.size() >= 8) break;
            }
        }
        if (structure.size() < 3) return null;
        out.set("structure", structure);

        ArrayNode tags = om.createArrayNode();
        JsonNode tagsIn = raw.get("tags");
        if (tagsIn != null && tagsIn.isArray()) {
            tagsIn.forEach(t -> {
                String v = t.asText("").strip();
                if (!v.isBlank()) tags.add(v);
            });
        }
        if (tags.size() == 0) tags.add("链接解析");
        out.set("tags", tags);
        out.put("score", clamp(raw.path("score").asInt(70), 0, 100));
        out.put("risk", clamp(raw.path("risk").asInt(videoUrl == null || videoUrl.isBlank() ? 2 : 1), 0, 3));
        out.put("reproduces", Math.max(0, raw.path("reproduces").asInt(0)));
        if (sourceUrl != null && !sourceUrl.isBlank()) out.put("source_url", sourceUrl);
        if (videoUrl != null && !videoUrl.isBlank()) out.put("video_url", videoUrl);
        out.put("analysis_mode", "manual_link_ai");
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

    private static String normalizePlatform(String p) {
        String v = p == null ? "" : p.strip().toLowerCase();
        return switch (v) {
            case "douyin", "xhs", "wechat", "kuaishou" -> v;
            case "xiaohongshu", "redbook", "小红书" -> "xhs";
            case "视频号", "weixin" -> "wechat";
            case "快手" -> "kuaishou";
            default -> "douyin";
        };
    }

    private static String categoryColor(String cat) {
        String c = cat == null ? "" : cat;
        if (c.contains("美妆")) return "#ff5b8a";
        if (c.contains("食品")) return "#22b59a";
        if (c.contains("服饰")) return "#5b3fe0";
        if (c.contains("小家电") || c.contains("数码")) return "#7c5cff";
        return "#f0a83a";
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private static String formatYuan(int cents) {
        return "¥" + String.format("%.2f", cents / 100.0);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String snippet(String s) {
        if (s == null) return "<null>";
        return s.length() > 1000 ? s.substring(0, 1000) + "…(截断)" : s;
    }
}
