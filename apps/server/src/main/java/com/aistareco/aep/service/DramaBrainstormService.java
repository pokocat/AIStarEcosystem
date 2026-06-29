package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaBrainstorm;
import com.aistareco.aep.repository.DramaBrainstormRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 首页脑暴草稿服务（v0.87，drama 子产品）—— 设计稿首页「跟 AI 聊出故事」链路的后端。
 *
 * 三件事：
 *   1. 脑暴草稿 CRUD（按 ownerUserId 隔离 + 软删 + 自动保存整页 BrainstormData）—— 立项之前的可恢复草稿。
 *   2. AI 脑暴对话（chat）+ 由对话生成「故事大纲」（outline）：复用 DRAMA_SCRIPT_DRAFT 已绑定端点，
 *      与 recipe / script-draft 一致**不扣费**（设计稿对话与大纲都无积分提示），但守 §8.0（未配置抛错不产假数据）。
 *   3. 「去制作」promote：按形态把脑暴成果落成一部 {@link DramaProject}（剧集，免费立项，预填角色）
 *      或一条 {@link DramaShort}（单片，扣开拍费），脑暴标 promoted。
 *
 * chat / outline **不落库**：返回 AI 结果（message / outline），由前端合并进 BrainstormData 后走 PUT 自动保存
 * （与 DramaProjectService 的 outline/epscript AI 起草同惯例，避免前后端并发覆盖）。
 */
@Service
public class DramaBrainstormService {

    private static final Logger log = LoggerFactory.getLogger(DramaBrainstormService.class);

    private static final String GREETING =
            "来，把你脑子里的画面或者一句话丢给我 —— 哪怕只是一个模糊的念头。\n"
                    + "比如「替嫁千金」「重生考研」「熬夜也能救的精华」… 我陪你聊成一部能拍的剧。";

    private final DramaBrainstormRepository repo;
    private final ObjectMapper om;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final DramaProjectService projectService;
    private final DramaShortService shortService;

    public DramaBrainstormService(DramaBrainstormRepository repo, ObjectMapper om,
                                  AiModelInvocationService invocation, PromptService promptService,
                                  DramaProjectService projectService, DramaShortService shortService) {
        this.repo = repo;
        this.om = om;
        this.invocation = invocation;
        this.promptService = promptService;
        this.projectService = projectService;
        this.shortService = shortService;
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    /** 「继续上次脑暴」列表卡片（BrainstormSummary[]）。 */
    public List<JsonNode> listBrainstorms(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaBrainstorm b : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            out.add(toSummary(b));
        }
        return out;
    }

    /** 详情：{ meta: BrainstormSummary, data: BrainstormData }。 */
    public JsonNode getBrainstorm(String id, String userId) {
        return toDetail(requireOwned(id, userId));
    }

    /**
     * 新建脑暴会话。body: { seed? } → seed 一份带开场白的 BrainstormData，立即落库（可恢复）。
     * seed（来自首页输入框 / 热点 / 创意卡）只放进 data.seed，首条用户消息与 AI 回复由前端随后调 /chat 触发。
     */
    public JsonNode createBrainstorm(JsonNode body, String userId) {
        OffsetDateTime now = OffsetDateTime.now();
        String seed = body == null ? null : text(body, "seed");
        DramaBrainstorm row = DramaBrainstorm.builder()
                .id("brs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(seedTitle(seed))
                .status("draft")
                .payloadJson(write(seedData(seed)))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(row);
        log.info("[drama-brainstorm] create user={} id={} seed={}", userId, row.getId(), seed != null);
        return toDetail(row);
    }

    /** 自动保存整页脑暴。body: { data: BrainstormData } → 落库并回算标题。promoted 后只读。 */
    public JsonNode saveBrainstorm(String id, JsonNode body, String userId) {
        DramaBrainstorm row = requireOwned(id, userId);
        if (body == null || !body.has("data") || !body.get("data").isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_BRAINSTORM_DATA_REQUIRED", "缺少要保存的脑暴数据");
        }
        applyData(row, (ObjectNode) body.get("data"));
        return toDetail(row);
    }

    public void deleteBrainstorm(String id, String userId) {
        DramaBrainstorm row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    // ── AI 脑暴对话 / 生成故事大纲（免费 · §8.0 守门 · 不落库） ───────────────────────

    /**
     * AI 脑暴回复。body: { text, messages? } → { message: { role:"ai", text, quick:string[] } }。
     * messages 为前端当前对话上下文（含刚发的 text 之前的历史）；缺省时回落到库里的对话。不落库。
     */
    public JsonNode chat(String id, JsonNode body, String userId) {
        DramaBrainstorm row = requireOwned(id, userId);
        String userText = text(body, "text");
        if (userText == null || userText.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_BRAINSTORM_TEXT_REQUIRED", "请先说点什么再发送");
        }
        requireLlm();
        List<String[]> turns = transcriptTurns(body, row);
        turns.add(new String[]{"user", userText.trim()});

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("transcript", renderTranscript(turns));
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_BRAINSTORM_CHAT, vars, 0.9);

        JsonNode root = callJson(pc);
        String reply = orDefault(text(root, "reply"), "");
        if (reply.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "脑暴助手没说出话来，请再试一次。");
        }
        ObjectNode message = om.createObjectNode();
        message.put("role", "ai");
        message.put("text", reply);
        ArrayNode quick = om.createArrayNode();
        if (root.path("quick").isArray()) {
            for (JsonNode q : root.path("quick")) {
                String s = q.asText("");
                if (!s.isBlank()) quick.add(s.trim());
            }
        }
        message.set("quick", quick);
        log.info("[drama-brainstorm] chat ok user={} id={} quick={}", userId, id, quick.size());
        ObjectNode out = om.createObjectNode();
        out.set("message", message);
        return out;
    }

    /**
     * 由对话生成「故事大纲」。body: { messages? } → { outline: OutlineDraft }（不落库，前端合并后 PUT 保存）。
     */
    public JsonNode generateOutline(String id, JsonNode body, String userId) {
        DramaBrainstorm row = requireOwned(id, userId);
        requireLlm();
        List<String[]> turns = transcriptTurns(body, row);
        if (turns.stream().noneMatch(t -> "user".equals(t[0]))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_BRAINSTORM_EMPTY", "先跟 AI 聊几句，再生成故事大纲。");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("transcript", renderTranscript(turns));
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_BRAINSTORM_OUTLINE, vars, 0.9);

        JsonNode root = callJson(pc);
        ObjectNode outline = normalizeOutline(root);
        if (outline.path("title").asText("").isBlank() || outline.path("beats").size() == 0) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "故事大纲生成失败，请再聊两句或重试。");
        }
        log.info("[drama-brainstorm] outline ok user={} id={} title={}", userId, id, outline.path("title").asText());
        ObjectNode out = om.createObjectNode();
        out.set("outline", outline);
        return out;
    }

    // ── 去制作（promote 成 项目 / 短视频） ────────────────────────────────────────

    /**
     * 「去制作」。body: { form?, data? }。
     *   form=series（默认）→ 新建一部 {@link DramaProject}（免费立项，预填 projectInfo + characters），返回 {kind:"project",projectId}。
     *   form=single        → 新建一条 {@link DramaShort}（扣开拍费），返回 {kind:"short",shortId}。
     * data 为前端当前 BrainstormData（含最新大纲 / 设置），传入则先落库再 promote；脑暴标 promoted（幂等）。
     */
    public JsonNode promote(String id, JsonNode body, String userId) {
        DramaBrainstorm row = requireOwned(id, userId);
        if (body != null && body.has("data") && body.get("data").isObject()) {
            applyData(row, (ObjectNode) body.get("data"));
        }
        // 幂等：已 promote 过直接回原去向，避免重复立项 / 重复扣费。
        if ("promoted".equals(row.getStatus()) && row.getPromotedId() != null) {
            return promotedResult(row.getPromotedKind(), row.getPromotedId());
        }
        JsonNode data = readPayload(row);
        JsonNode outline = data.path("outline");
        if (!outline.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_BRAINSTORM_NO_OUTLINE", "请先生成故事大纲，再去制作。");
        }
        String form = orDefault(text(body, "form"), text(data.path("settings"), "form"));
        boolean single = "single".equals(form);
        String ratio = orDefault(text(data.path("settings"), "ratio"), "9:16");

        String title = orDefault(text(outline, "title"), orDefault(row.getTitle(), "未命名短剧"));
        String type = orDefault(text(outline, "type"), "通用短剧");
        String logline = orDefault(text(outline, "logline"), "");
        String mainline = orDefault(text(outline, "mainline"), joinBeats(outline.path("beats")));

        if (single) {
            String styleRef = (logline.isBlank() ? "" : logline)
                    + (mainline.isBlank() ? "" : (logline.isBlank() ? "" : " ") + "主线：" + mainline);
            String shortId = shortService.createFromRecipe(userId, title, type,
                    "#f97316", "#e11d48", title, styleRef.isBlank() ? title : styleRef);
            markPromoted(row, "short", shortId);
            log.info("[drama-brainstorm] promote->short user={} brs={} short={}", userId, id, shortId);
            return promotedResult("short", shortId);
        }

        int episodes = data.path("settings").path("episodes").asInt(0);
        ObjectNode pbody = om.createObjectNode();
        pbody.put("title", title);
        pbody.put("type", type);
        pbody.put("typeKey", "custom");
        pbody.put("mode", "guided");
        pbody.put("ratio", ratio);
        pbody.put("episodes", episodes > 0 ? episodes : 12);
        pbody.put("logline", logline);
        pbody.put("mainline", mainline);
        JsonNode detail = projectService.createProject(pbody, userId);
        String projectId = detail.path("meta").path("id").asText();

        // 把大纲里的核心人物 + 取景参考预填进项目「角色与场景」（短剧设定页即见），减少重复劳动。
        ArrayNode chars = charactersFromRoles(outline.path("roles"));
        ArrayNode scenes = scenesFromOutline(outline.path("scenes"));
        if (chars.size() > 0 || scenes.size() > 0) {
            ObjectNode pdata = ((ObjectNode) detail.path("data")).deepCopy();
            if (chars.size() > 0) pdata.set("characters", chars);
            if (scenes.size() > 0) pdata.set("scenes", scenes);
            ObjectNode saveBody = om.createObjectNode();
            saveBody.set("data", pdata);
            projectService.saveProject(projectId, saveBody, userId);
        }
        markPromoted(row, "project", projectId);
        log.info("[drama-brainstorm] promote->project user={} brs={} project={} chars={} scenes={}",
                userId, id, projectId, chars.size(), scenes.size());
        return promotedResult("project", projectId);
    }

    // ── 内部：脑暴态构建 ─────────────────────────────────────────────────────────

    /** 新建时的最小 BrainstormData（开场白 + 默认制作设置；seed 入 data.seed 供前端首条消息用）。 */
    private ObjectNode seedData(String seed) {
        ObjectNode root = om.createObjectNode();
        if (seed != null && !seed.isBlank()) root.put("seed", seed); else root.putNull("seed");
        root.putNull("direction");
        ArrayNode messages = om.createArrayNode();
        ObjectNode greet = om.createObjectNode();
        greet.put("role", "ai");
        greet.put("text", GREETING);
        ArrayNode quick = om.createArrayNode();
        quick.add("我没想法，给点灵感");
        quick.add("套爆款模板");
        greet.set("quick", quick);
        messages.add(greet);
        root.set("messages", messages);
        root.putNull("outline");
        ObjectNode settings = om.createObjectNode();
        settings.put("form", "series");
        settings.put("ratio", "9:16");
        root.set("settings", settings);
        return root;
    }

    /** 落库整页 BrainstormData + 回算标题（大纲标题优先，其次首条用户消息）。 */
    private void applyData(DramaBrainstorm row, ObjectNode incoming) {
        ObjectNode data = incoming.deepCopy();
        String title = text(data.path("outline"), "title");
        if (title == null || title.isBlank()) title = firstUserMessage(data.path("messages"));
        if (title != null && !title.isBlank()) row.setTitle(title.length() > 40 ? title.substring(0, 40) : title);
        row.setPayloadJson(write(data));
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
    }

    private void markPromoted(DramaBrainstorm row, String kind, String promotedId) {
        row.setStatus("promoted");
        row.setPromotedKind(kind);
        row.setPromotedId(promotedId);
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
    }

    private JsonNode promotedResult(String kind, String id) {
        ObjectNode out = om.createObjectNode();
        out.put("kind", "short".equals(kind) ? "short" : "project");
        out.put("short".equals(kind) ? "shortId" : "projectId", id);
        return out;
    }

    /** 大纲核心人物 → 项目角色阵容（CharacterDef[]）：前两个 / 含「主」的判为主角(key)。 */
    private ArrayNode charactersFromRoles(JsonNode roles) {
        ArrayNode out = om.createArrayNode();
        if (!roles.isArray()) return out;
        int i = 1;
        for (JsonNode r : roles) {
            if (!r.isObject()) continue;
            String name = orDefault(text(r, "name"), "角色 " + i);
            String roleDesc = orDefault(text(r, "role"), "");
            boolean key = i <= 2 || roleDesc.contains("主");
            ObjectNode ch = om.createObjectNode();
            ch.put("id", "ch_" + i);
            ch.put("name", name);
            ch.put("role", key ? "key" : "extra");
            ch.put("cast", roleDesc);
            ch.put("desc", "");
            ch.put("avatar", "a" + (((i - 1) % 8) + 1));
            ch.put("bound", false);
            out.add(ch);
            i++;
        }
        return out;
    }

    /** 大纲取景参考（string[]）→ 项目场景设定 SceneAsset[]（name 来自取景，mood 留空待填）。 */
    private ArrayNode scenesFromOutline(JsonNode scenesIn) {
        ArrayNode out = om.createArrayNode();
        if (!scenesIn.isArray()) return out;
        int i = 1;
        for (JsonNode s : scenesIn) {
            String name = s.asText("");
            if (name.isBlank()) continue;
            ObjectNode scene = om.createObjectNode();
            scene.put("id", "scn_" + i);
            scene.put("name", name.trim());
            scene.put("mood", "");
            out.add(scene);
            i++;
        }
        return out;
    }

    /** 把大模型返回的大纲归一化为 OutlineDraft（数组/字段缺省都补齐）。 */
    private ObjectNode normalizeOutline(JsonNode root) {
        ObjectNode o = om.createObjectNode();
        o.put("title", orDefault(text(root, "title"), ""));
        o.put("type", orDefault(text(root, "type"), "通用短剧"));
        o.put("tone", orDefault(text(root, "tone"), ""));
        o.put("logline", orDefault(text(root, "logline"), ""));
        o.put("mainline", orDefault(text(root, "mainline"), ""));
        ArrayNode beats = om.createArrayNode();
        if (root.path("beats").isArray()) {
            for (JsonNode b : root.path("beats")) {
                String s = b.asText("");
                if (!s.isBlank()) beats.add(s.trim());
            }
        }
        o.set("beats", beats);
        ArrayNode roles = om.createArrayNode();
        if (root.path("roles").isArray()) {
            for (JsonNode r : root.path("roles")) {
                if (!r.isObject()) continue;
                String name = text(r, "name");
                if (name == null || name.isBlank()) continue;
                ObjectNode role = om.createObjectNode();
                role.put("name", name.trim());
                role.put("role", orDefault(text(r, "role"), ""));
                roles.add(role);
            }
        }
        o.set("roles", roles);
        ArrayNode scenes = om.createArrayNode();
        if (root.path("scenes").isArray()) {
            for (JsonNode s : root.path("scenes")) {
                String v = s.asText("");
                if (!v.isBlank()) scenes.add(v.trim());
            }
        }
        o.set("scenes", scenes);
        return o;
    }

    private static String joinBeats(JsonNode beats) {
        if (!beats.isArray()) return "";
        List<String> parts = new ArrayList<>();
        for (JsonNode b : beats) {
            String s = b.asText("");
            if (!s.isBlank()) parts.add(s.trim());
        }
        return String.join(" → ", parts);
    }

    /** 取上下文对话轮次：优先 body.messages（前端当前态），缺省回落库里的对话。 */
    private List<String[]> transcriptTurns(JsonNode body, DramaBrainstorm row) {
        JsonNode messages = body != null && body.path("messages").isArray()
                ? body.path("messages") : readPayload(row).path("messages");
        List<String[]> turns = new ArrayList<>();
        if (messages.isArray()) {
            for (JsonNode m : messages) {
                String role = "user".equals(m.path("role").asText("")) ? "user" : "ai";
                String t = m.path("text").asText("");
                if (!t.isBlank()) turns.add(new String[]{role, t.trim()});
            }
        }
        return turns;
    }

    private static String renderTranscript(List<String[]> turns) {
        StringBuilder sb = new StringBuilder();
        for (String[] t : turns) {
            sb.append("user".equals(t[0]) ? "用户：" : "助手：").append(t[1]).append("\n");
        }
        return sb.toString().trim();
    }

    private static String firstUserMessage(JsonNode messages) {
        if (!messages.isArray()) return null;
        for (JsonNode m : messages) {
            if ("user".equals(m.path("role").asText(""))) {
                String t = m.path("text").asText("");
                if (!t.isBlank()) return t.trim();
            }
        }
        return null;
    }

    private static String seedTitle(String seed) {
        if (seed == null || seed.isBlank()) return "新的脑暴";
        String s = seed.trim();
        return s.length() > 40 ? s.substring(0, 40) : s;
    }

    // ── 内部：卡片 / 详情 ────────────────────────────────────────────────────────

    private ObjectNode toSummary(DramaBrainstorm b) {
        JsonNode data = readPayload(b);
        ObjectNode o = om.createObjectNode();
        o.put("id", b.getId());
        o.put("title", orDefault(b.getTitle(), "新的脑暴"));
        o.put("status", orDefault(b.getStatus(), "draft"));
        if (b.getPromotedKind() != null) o.put("promotedKind", b.getPromotedKind()); else o.putNull("promotedKind");
        if (b.getPromotedId() != null) o.put("promotedId", b.getPromotedId()); else o.putNull("promotedId");
        o.put("messageCount", data.path("messages").isArray() ? data.path("messages").size() : 0);
        o.put("hasOutline", data.path("outline").isObject());
        o.put("form", orDefault(text(data.path("settings"), "form"), "series"));
        o.put("updated", relativeTime(b.getUpdatedAt()));
        o.put("updatedAt", b.getUpdatedAt() != null ? b.getUpdatedAt().toString() : null);
        return o;
    }

    private ObjectNode toDetail(DramaBrainstorm b) {
        ObjectNode out = om.createObjectNode();
        out.set("meta", toSummary(b));
        out.set("data", readPayload(b));
        return out;
    }

    // ── 内部：归属 / AI 调用 / 工具 ──────────────────────────────────────────────

    private DramaBrainstorm requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_BRAINSTORM_NOT_FOUND", "脑暴草稿不存在"));
    }

    private void requireLlm() {
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "AI 脑暴还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
    }

    private record PromptCall(String system, String user, double temperature, int maxTokens, boolean jsonMode) {}

    private PromptCall preparePrompt(String promptKey, Map<String, String> vars, double defaultTemp) {
        PromptService.ResolvedPrompt p = promptService.resolve(promptKey);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "该脑暴 AI 动作的提示词尚未配置（promptKey=" + promptKey
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        double temperature = p.params().temperature() != null ? p.params().temperature() : defaultTemp;
        int maxTokens = p.params().maxTokens() != null && p.params().maxTokens() > 0 ? p.params().maxTokens() : 2048;
        boolean jsonMode = p.params().jsonMode() == null || p.params().jsonMode();
        log.info("[drama-ai] promptKey={} origin={} vars={}", promptKey, p.origin(), vars.keySet());
        return new PromptCall(p.system(), PromptService.fill(p.userTemplate(), vars), temperature, maxTokens, jsonMode);
    }

    private AiModelInvocationService.AiModelResponse invoke(PromptCall pc) {
        List<Map<String, String>> messages = new ArrayList<>();
        if (pc.system() != null && !pc.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", pc.system()));
        }
        messages.add(Map.of("role", "user", "content", pc.user()));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", pc.temperature());
        options.put("max_tokens", pc.maxTokens());
        if (pc.jsonMode()) options.put("response_format", Map.of("type", "json_object"));
        try {
            return invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "AI 脑暴调用失败，请稍后重试。");
        }
    }

    private JsonNode callJson(PromptCall pc) {
        JsonNode root = tryReadJson(invoke(pc).content());
        if (root == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "AI 返回的内容无法解析，请重试。");
        }
        return root;
    }

    private JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        if (s.startsWith("```")) {
            int firstNl = s.indexOf('\n');
            if (firstNl >= 0) s = s.substring(firstNl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.trim();
        }
        try {
            return om.readTree(s);
        } catch (Exception e) {
            int lb = s.indexOf('{');
            int la = s.indexOf('[');
            int start = (lb < 0) ? la : (la < 0 ? lb : Math.min(lb, la));
            int end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
            if (start >= 0 && end > start) {
                try {
                    return om.readTree(s.substring(start, end + 1));
                } catch (Exception ignore) {
                    return null;
                }
            }
            return null;
        }
    }

    private JsonNode readPayload(DramaBrainstorm row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private static String relativeTime(OffsetDateTime t) {
        if (t == null) return "刚刚";
        long days = Duration.between(t, OffsetDateTime.now()).toDays();
        if (days <= 0) return "今天";
        if (days == 1) return "昨天";
        if (days < 7) return days + " 天前";
        return (days / 7) + " 周前";
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return "{}";
        }
    }
}
