package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.repository.DramaProjectRepository;
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
 * 短剧项目工作台服务（v0.64+，drama 子产品）。
 *
 * 三件事：
 *   1. 项目 CRUD（按 ownerUserId 隔离 + 软删）；列表卡片用核心字段，详情/保存用整套 ProjectData 文档。
 *   2. 新建时按内容类型 seed 一份「空但合法」的 ProjectData，让六阶段工作台各页都能渲染空状态。
 *   3. 大纲 AI 起草（大模型）：按 projectInfo 生成分集大纲 EpisodeOutline[]，复用 DRAMA_SCRIPT_DRAFT 已绑定端点。
 *
 * 不静默兜底：大模型未配置 / 调用失败 / 输出无法解析 → 抛带 code 的明确错误，前端展示。
 */
@Service
public class DramaProjectService {

    private static final Logger log = LoggerFactory.getLogger(DramaProjectService.class);

    private final DramaProjectRepository repo;
    private final AiModelInvocationService invocation;
    private final ObjectMapper om;

    public DramaProjectService(DramaProjectRepository repo,
                               AiModelInvocationService invocation,
                               ObjectMapper om) {
        this.repo = repo;
        this.invocation = invocation;
        this.om = om;
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    /** 列表卡片（DramaProjectSummary[]）。 */
    public List<JsonNode> listProjects(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaProject p : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            out.add(toSummary(p));
        }
        return out;
    }

    /** 详情：{ meta: DramaProjectSummary, data: ProjectData }。 */
    public JsonNode getProject(String id, String userId) {
        DramaProject row = requireOwned(id, userId);
        return toDetail(row);
    }

    /**
     * 新建项目。body: { type, typeKey, mode, title?, ratio?, episodes?, logline?, mainline? }
     * → seed 一份空 ProjectData，返回 { meta, data }。
     */
    public JsonNode createProject(JsonNode body, String userId) {
        if (body == null || !body.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROJECT_BODY_REQUIRED", "缺少新建项目参数");
        }
        OffsetDateTime now = OffsetDateTime.now();
        String type = orDefault(text(body, "type"), "通用短剧");
        String typeKey = orDefault(text(body, "typeKey"), "custom");
        String ratio = orDefault(text(body, "ratio"), "9:16");
        int episodes = body.path("episodes").asInt(1);
        String mode = orDefault(text(body, "mode"), "guided");
        String title = orDefault(text(body, "title"), "未命名短剧");

        DramaProject row = DramaProject.builder()
                .id("dp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(title)
                .type(type)
                .typeKey(typeKey)
                .ratio(ratio)
                .episodes(episodes)
                .progress(0)
                .stage(1)
                .mode(mode)
                .coverFrom(orDefault(text(body, "coverFrom"), "#f97316"))
                .coverTo(orDefault(text(body, "coverTo"), "#e11d48"))
                .payloadJson(write(seedProjectData(title, type, episodes, ratio,
                        orDefault(text(body, "logline"), ""), orDefault(text(body, "mainline"), ""))))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(row);
        log.info("[drama-project] create user={} id={} type={} mode={}", userId, row.getId(), typeKey, mode);
        return toDetail(row);
    }

    /**
     * 保存整套工作台文档。body: { data: ProjectData, stage?, progress? } → 落库并回算卡片字段。
     */
    public JsonNode saveProject(String id, JsonNode body, String userId) {
        DramaProject row = requireOwned(id, userId);
        if (body == null || !body.has("data") || !body.get("data").isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROJECT_DATA_REQUIRED", "缺少要保存的工作台数据");
        }
        ObjectNode data = ((ObjectNode) body.get("data")).deepCopy();
        // 卡片核心字段以 projectInfo 为准回写，列表才会同步。
        JsonNode info = data.get("projectInfo");
        if (info != null && info.isObject()) {
            String title = text(info, "title");
            if (title != null && !title.isBlank()) row.setTitle(title);
            String type = text(info, "type");
            if (type != null && !type.isBlank()) row.setType(type);
            String ratio = text(info, "ratio");
            if (ratio != null && !ratio.isBlank()) row.setRatio(ratio);
            int eps = info.path("episodes").asInt(row.getEpisodes());
            if (eps > 0) row.setEpisodes(eps);
        }
        if (body.has("stage")) row.setStage(clamp(body.path("stage").asInt(row.getStage()), 1, 6));
        if (body.has("progress")) row.setProgress(clamp(body.path("progress").asInt(row.getProgress()), 0, 100));
        row.setPayloadJson(write(data));
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
        return toDetail(row);
    }

    public void deleteProject(String id, String userId) {
        DramaProject row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    // ── 大纲 AI 起草 ───────────────────────────────────────────────────────────

    /**
     * 按 projectInfo 生成分集大纲。body: { count? } → { episodes: [ {no,hook,synopsis,beat} ... ] }（未落库）。
     * 复用 DRAMA_SCRIPT_DRAFT 已绑定的端点，但用大纲专属 prompt。
     */
    public JsonNode outlineAiDraft(String id, JsonNode body, String userId) {
        DramaProject row = requireOwned(id, userId);
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "大纲生成还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        JsonNode data = readPayload(row);
        JsonNode info = data.path("projectInfo");
        String title = orDefault(text(info, "title"), orDefault(row.getTitle(), "未命名短剧"));
        String type = orDefault(text(info, "type"), orDefault(row.getType(), "短剧"));
        String logline = orDefault(text(info, "logline"), "");
        String mainline = orDefault(text(info, "mainline"), "");
        int total = info.path("episodes").asInt(row.getEpisodes() > 0 ? row.getEpisodes() : 6);
        int count = clamp(body != null ? body.path("count").asInt(Math.min(total, 6)) : Math.min(total, 6), 1, 12);

        String system = "你是资深短剧编剧。只输出 JSON，不要解释。";
        String user = "为短剧《" + title + "》（类型：" + type + "）生成分集大纲，共 " + count + " 集。"
                + (logline.isBlank() ? "" : "一句话简介：" + logline + "。")
                + (mainline.isBlank() ? "" : "主线：" + mainline + "。")
                + "每集要有强钩子。严格返回 JSON：{\"episodes\":[{\"no\":集号(整数),"
                + "\"hook\":\"开场钩子\",\"synopsis\":\"剧情梗概\",\"beat\":\"情绪转折/记忆点\"}]}";

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", system));
        messages.add(Map.of("role", "user", "content", user));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", 0.9);
        options.put("max_tokens", 4096);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "大纲生成调用失败，请稍后重试。");
        }

        ArrayNode episodes = parseEpisodes(resp.content());
        if (episodes.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "大纲生成返回的内容无法解析，请重试或换个说法。");
        }
        log.info("[drama-project] outline ai-draft ok user={} id={} got={} model={}",
                userId, id, episodes.size(), resp.modelUsed());
        ObjectNode out = om.createObjectNode();
        out.set("episodes", episodes);
        return out;
    }

    // ── 内部工具 ────────────────────────────────────────────────────────────────

    private DramaProject requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
    }

    /** 新建时的空 ProjectData（结构合法、各数组为空，前端各阶段渲染空状态）。 */
    private ObjectNode seedProjectData(String title, String type, int episodes, String ratio,
                                       String logline, String mainline) {
        ObjectNode root = om.createObjectNode();
        ObjectNode info = om.createObjectNode();
        info.put("title", title);
        info.put("type", type);
        info.put("episodes", Math.max(1, episodes));
        info.put("duration", ratio.startsWith("16") ? "约 60 秒" : "每集 ~75 秒");
        info.put("ratio", ratio);
        info.put("logline", logline);
        info.put("mainline", mainline);
        root.set("projectInfo", info);
        root.set("topicCards", om.createArrayNode());
        root.set("episodes", om.createArrayNode());
        root.set("characters", om.createArrayNode());
        ObjectNode script = om.createObjectNode();
        script.put("ep", 1);
        script.set("scenes", om.createArrayNode());
        root.set("script", script);
        ObjectNode storyboard = om.createObjectNode();
        storyboard.put("ep", 1);
        storyboard.set("scenes", om.createArrayNode());
        root.set("storyboard", storyboard);
        ObjectNode promptPack = om.createObjectNode();
        promptPack.put("ep", 1);
        promptPack.put("scene", "");
        promptPack.set("shots", om.createArrayNode());
        root.set("promptPack", promptPack);
        return root;
    }

    private ArrayNode parseEpisodes(String content) {
        ArrayNode out = om.createArrayNode();
        JsonNode root = tryReadJson(content);
        if (root == null) return out;
        JsonNode arr = null;
        if (root.isArray()) arr = root;
        else if (root.has("episodes") && root.get("episodes").isArray()) arr = root.get("episodes");
        else if (root.has("outlines") && root.get("outlines").isArray()) arr = root.get("outlines");
        if (arr == null) return out;
        int i = 1;
        for (JsonNode e : arr) {
            if (!e.isObject()) continue;
            ObjectNode ep = om.createObjectNode();
            int no = e.path("no").asInt(i);
            ep.put("no", no);
            ep.put("hook", orDefault(text(e, "hook"), ""));
            ep.put("synopsis", orDefault(text(e, "synopsis"), orDefault(text(e, "summary"), "")));
            ep.put("beat", orDefault(text(e, "beat"), ""));
            out.add(ep);
            i++;
        }
        return out;
    }

    private JsonNode readPayload(DramaProject row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private ObjectNode toSummary(DramaProject p) {
        ObjectNode s = om.createObjectNode();
        s.put("id", p.getId());
        s.put("title", orDefault(p.getTitle(), "未命名短剧"));
        s.put("type", orDefault(p.getType(), "短剧"));
        s.put("typeKey", orDefault(p.getTypeKey(), "custom"));
        s.put("ratio", orDefault(p.getRatio(), "9:16"));
        s.put("episodes", p.getEpisodes());
        s.put("progress", p.getProgress());
        s.put("stage", p.getStage() > 0 ? p.getStage() : 1);
        ObjectNode cover = om.createObjectNode();
        cover.put("from", orDefault(p.getCoverFrom(), "#f97316"));
        cover.put("to", orDefault(p.getCoverTo(), "#e11d48"));
        s.set("cover", cover);
        s.put("mode", orDefault(p.getMode(), "guided"));
        s.put("updated", relativeTime(p.getUpdatedAt()));
        s.put("updatedAt", p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null);
        if (p.getProgress() >= 100) s.put("done", true);
        return s;
    }

    private ObjectNode toDetail(DramaProject p) {
        ObjectNode out = om.createObjectNode();
        out.set("meta", toSummary(p));
        out.set("data", readPayload(p));
        return out;
    }

    /** 简易相对时间（今天 / 昨天 / N 天前 / N 周前），匹配前端 updated 文案。 */
    private static String relativeTime(OffsetDateTime t) {
        if (t == null) return "刚刚";
        long days = Duration.between(t, OffsetDateTime.now()).toDays();
        if (days <= 0) return "今天";
        if (days == 1) return "昨天";
        if (days < 7) return days + " 天前";
        return (days / 7) + " 周前";
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

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
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
