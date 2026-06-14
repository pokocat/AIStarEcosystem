package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaInteractiveSeries;
import com.aistareco.aep.repository.DramaInteractiveSeriesRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 互动短剧服务（v0.74，drama 子产品「剧情互动」）。
 *
 * 一部剧 = 剧集有向图（整张图存一行 payloadJson）。本服务三件事：
 *   1. 剧集图 CRUD（按 ownerUserId 隔离 + 软删）；
 *   2. AI 起草整张剧集图（大模型，prompt = KEY_DRAMA_INTERACTIVE_DRAFT，
 *      复用 DRAMA_SCRIPT_DRAFT 端点绑定 —— 同 v0.71 工作台各 AI 动作的惯例）；
 *   3. 按集生成视频 —— 复用 MaterialVideoJobService（kind="drama-interactive-node"，
 *      回写 node.video_job_id；轮询沿用既有 /api/me/drama/episodes/jobs/{id}）。
 *
 * 不静默兜底：大模型未配置 / 调用失败 / 输出无法解析 → 抛带 code 的明确错误，前端展示。
 */
@Service
public class DramaInteractiveService {

    private static final Logger log = LoggerFactory.getLogger(DramaInteractiveService.class);

    private final DramaInteractiveSeriesRepository repo;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final MaterialVideoJobService videoJobService;
    private final ObjectMapper om;

    public DramaInteractiveService(DramaInteractiveSeriesRepository repo,
                                   AiModelInvocationService invocation,
                                   PromptService promptService,
                                   MaterialVideoJobService videoJobService,
                                   ObjectMapper om) {
        this.repo = repo;
        this.invocation = invocation;
        this.promptService = promptService;
        this.videoJobService = videoJobService;
        this.om = om;
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    public List<JsonNode> listSeries(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaInteractiveSeries s : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            out.add(toSummary(s));
        }
        return out;
    }

    public JsonNode getSeries(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .map(this::toFull)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "INTERACTIVE_NOT_FOUND", "互动剧不存在"));
    }

    public JsonNode saveSeries(JsonNode body, String userId) {
        if (body == null || !body.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INTERACTIVE_BODY_REQUIRED", "缺少互动剧内容");
        }
        String id = text(body, "id");
        OffsetDateTime now = OffsetDateTime.now();
        DramaInteractiveSeries row = (id != null && !id.isBlank())
                ? repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null)
                : null;
        if (row == null) {
            row = DramaInteractiveSeries.builder()
                    .id(id != null && !id.isBlank() ? id : "dis_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                    .ownerUserId(userId)
                    .createdAt(now)
                    .build();
        }
        ObjectNode payload = ((ObjectNode) body).deepCopy();
        payload.put("id", row.getId());
        String status = deriveStatus(payload);
        payload.put("status", status);
        row.setTitle(orDefault(text(body, "title"), "未命名互动剧"));
        row.setGenre(orDefault(text(body, "genre"), "都市"));
        row.setStatus(status);
        row.setPayloadJson(write(payload));
        row.setUpdatedAt(now);
        repo.save(row);
        return toFull(row);
    }

    public void deleteSeries(String id, String userId) {
        DramaInteractiveSeries row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    // ── AI 起草 ─────────────────────────────────────────────────────────────────

    /** body: { theme, genre?, branch_points?, endings? } → 起草并落库一整张剧集分支图，返回完整 series。 */
    public JsonNode aiDraft(JsonNode body, String userId) {
        PromptService.ResolvedPrompt prompt = promptService.resolve(PromptService.KEY_DRAMA_INTERACTIVE_DRAFT);
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "互动剧 AI 起草还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        if ("code".equals(prompt.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "互动剧 AI 起草的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_INTERACTIVE_DRAFT + "）。");
        }
        String theme = orDefault(text(body, "theme"), "");
        if (theme.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "INTERACTIVE_THEME_REQUIRED", "请先填写故事主题 / 一句话灵感");
        }
        String genre = orDefault(text(body, "genre"), "都市悬疑");
        int branchPoints = clamp(body != null ? body.path("branch_points").asInt(1) : 1, 1, 2);
        int endings = clamp(body != null ? body.path("endings").asInt(2) : 2, 2, 4);
        log.info("[interactive] ai-draft start user={} genre={} branchPoints={} endings={} themeLength={}",
                userId, genre, branchPoints, endings, theme.length());

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("theme", theme);
        vars.put("genre", genre);
        vars.put("branch_points", String.valueOf(branchPoints));
        vars.put("endings", String.valueOf(endings));
        String userContent = PromptService.fill(prompt.userTemplate(), vars);

        List<Map<String, String>> messages = new ArrayList<>();
        if (prompt.system() != null && !prompt.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", prompt.system()));
        }
        messages.add(Map.of("role", "user", "content", userContent));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", prompt.params().temperature() != null ? prompt.params().temperature() : 0.9);
        options.put("max_tokens", prompt.params().maxTokens() != null && prompt.params().maxTokens() > 0
                ? prompt.params().maxTokens() : 4096);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "互动剧 AI 起草调用失败，请稍后重试。");
        }

        ObjectNode series = parseSeries(resp.content(), genre);
        if (series == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "互动剧 AI 起草返回的内容无法解析，请重试或换个说法。");
        }
        OffsetDateTime now = OffsetDateTime.now();
        String id = "dis_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        series.put("id", id);
        String status = deriveStatus(series);
        series.put("status", status);
        DramaInteractiveSeries row = DramaInteractiveSeries.builder()
                .id(id).ownerUserId(userId)
                .title(orDefault(text(series, "title"), "未命名互动剧"))
                .genre(orDefault(text(series, "genre"), genre))
                .status(status)
                .payloadJson(write(series))
                .createdAt(now).updatedAt(now)
                .build();
        repo.save(row);
        log.info("[interactive] ai-draft ok user={} theme='{}' episodes={} model={}",
                userId, preview(theme), series.path("episodes").size(), resp.modelUsed());
        return toFull(row);
    }

    // ── 按集生成视频（复用 MaterialVideoJobService） ─────────────────────────────

    /** 提交一集的视频任务（kind="drama-interactive-node"），回写 node.video_job_id，返回任务卡。 */
    public JsonNode generateEpisode(String seriesId, String episodeId, String userId) {
        DramaInteractiveSeries row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(seriesId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "INTERACTIVE_NOT_FOUND", "互动剧不存在"));
        ObjectNode payload = readPayload(row);
        ObjectNode node = findEpisode(payload, episodeId);
        if (node == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "INTERACTIVE_EPISODE_NOT_FOUND", "剧集不存在");
        }
        int durationSec = node.path("duration_sec").asInt(60);
        String prompt = buildNodePrompt(payload, node);
        String name = orDefault(text(node, "title"), "互动剧片段");

        ObjectNode item = om.createObjectNode();
        item.put("script_id", seriesId);
        item.put("kind", "drama-interactive-node");
        item.put("name", name);
        item.put("prompt", prompt);
        item.put("duration_sec", durationSec);
        item.put("aspect_ratio", "9:16");
        ArrayNode items = om.createArrayNode();
        items.add(item);
        ObjectNode submitBody = om.createObjectNode();
        submitBody.set("items", items);

        List<JsonNode> jobs = videoJobService.submit(submitBody, userId);
        JsonNode job = jobs.isEmpty() ? null : jobs.get(0);
        if (job != null && job.hasNonNull("id")) {
            node.put("video_job_id", job.get("id").asText());
            node.put("gen_status", "generating");
            row.setPayloadJson(write(payload));
            row.setUpdatedAt(OffsetDateTime.now());
            repo.save(row);
        }
        log.info("[interactive] generate-episode user={} seriesId={} episodeId={} job={}",
                userId, seriesId, episodeId, job != null ? job.path("id").asText() : "none");
        return job != null ? job : om.createObjectNode();
    }

    // ── 解析 / 派生 / 工具 ──────────────────────────────────────────────────────

    /** 把大模型输出解析成一张剧集图：规整 episode id / gen_status / choice id，兜底 start_episode_id。 */
    private ObjectNode parseSeries(String content, String genre) {
        JsonNode root = tryReadJson(content);
        if (root == null || !root.isObject()) return null;
        ObjectNode s = ((ObjectNode) root).deepCopy();
        JsonNode episodes = s.get("episodes");
        if (episodes == null || !episodes.isArray() || episodes.isEmpty()) return null;
        Set<String> ids = new LinkedHashSet<>();
        for (JsonNode ep : episodes) {
            if (!ep.isObject()) continue;
            ObjectNode node = (ObjectNode) ep;
            if (!node.hasNonNull("id")) {
                node.put("id", "ep_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
            }
            ids.add(node.get("id").asText());
            if (!node.hasNonNull("gen_status")) node.put("gen_status", "idle");
            JsonNode inter = node.get("interaction");
            if (inter != null && inter.isObject()) {
                JsonNode choices = inter.get("choices");
                if (choices != null && choices.isArray()) {
                    for (JsonNode c : choices) {
                        if (c.isObject() && !c.hasNonNull("id")) {
                            ((ObjectNode) c).put("id", "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
                        }
                    }
                }
            }
        }
        if (!s.hasNonNull("genre")) s.put("genre", genre);
        if (!s.hasNonNull("title")) s.put("title", "未命名互动剧");
        String start = text(s, "start_episode_id");
        if (start == null || !ids.contains(start)) {
            s.put("start_episode_id", episodes.get(0).path("id").asText());
        }
        return s;
    }

    /** 把一集拼成视频大模型提示词（优先用 scenes，没有就用 synopsis）。 */
    private String buildNodePrompt(JsonNode series, JsonNode node) {
        StringBuilder sb = new StringBuilder();
        int durationSec = node.path("duration_sec").asInt(60);
        sb.append("请生成一条 ").append(durationSec).append("s、比例 9:16 的竖屏短剧视频片段，")
                .append("风格电影感、画面稳定清晰、表演到位、无水印。\n");
        String seriesTitle = text(series, "title");
        String genre = text(series, "genre");
        String epTitle = text(node, "title");
        String synopsis = text(node, "synopsis");
        if (seriesTitle != null) sb.append("【剧名】").append(seriesTitle).append(genre != null ? "（" + genre + "）" : "").append("\n");
        if (epTitle != null) sb.append("【本集】").append(epTitle).append("\n");
        if (synopsis != null && !synopsis.isBlank()) sb.append("【剧情】").append(synopsis).append("\n");
        JsonNode scenes = node.get("scenes");
        if (scenes != null && scenes.isArray() && scenes.size() > 0) {
            sb.append("【分镜】（共 ").append(scenes.size()).append(" 镜）\n");
            int i = 1;
            for (JsonNode sc : scenes) {
                String heading = orDefault(text(sc, "heading"), "镜头");
                int dur = sc.path("duration_sec").asInt(0);
                String summary = orDefault(text(sc, "summary"), "");
                String dialogue = orDefault(text(sc, "dialogue"), "");
                String shot = orDefault(text(sc, "shot"), "");
                sb.append("  镜").append(i++).append(" · ").append(heading);
                if (dur > 0) sb.append(" · ").append(dur).append("s");
                sb.append("：").append(summary);
                if (!dialogue.isBlank()) sb.append("｜台词：").append(dialogue);
                if (!shot.isBlank()) sb.append("｜画面：").append(shot);
                sb.append("\n");
            }
        }
        sb.append("要求：镜头语言连贯、符合短剧快节奏；台词自然口语；情绪与冲突到位；结尾留钩子（除非这是结局集）。");
        return sb.toString();
    }

    private JsonNode toSummary(DramaInteractiveSeries row) {
        ObjectNode o = om.createObjectNode();
        ObjectNode payload = readPayload(row);
        JsonNode episodes = payload.get("episodes");
        int epCount = 0, branchCount = 0, endingCount = 0, readyCount = 0;
        if (episodes != null && episodes.isArray()) {
            epCount = episodes.size();
            for (JsonNode ep : episodes) {
                JsonNode inter = ep.get("interaction");
                if (inter != null && inter.isObject() && inter.path("choices").isArray() && inter.path("choices").size() > 0) {
                    branchCount++;
                }
                if (ep.path("is_ending").asBoolean(false)) endingCount++;
                if ("ready".equals(ep.path("gen_status").asText(""))) readyCount++;
            }
        }
        o.put("id", row.getId());
        o.put("title", orDefault(row.getTitle(), "未命名互动剧"));
        o.put("genre", orDefault(row.getGenre(), ""));
        o.put("status", orDefault(row.getStatus(), "draft"));
        o.put("episode_count", epCount);
        o.put("branch_count", branchCount);
        o.put("ending_count", endingCount);
        o.put("ready_count", readyCount);
        o.put("updated_at", row.getUpdatedAt() != null ? row.getUpdatedAt().toString() : null);
        return o;
    }

    private JsonNode toFull(DramaInteractiveSeries row) {
        ObjectNode payload = readPayload(row);
        payload.put("id", row.getId());
        payload.put("title", orDefault(row.getTitle(), "未命名互动剧"));
        payload.put("genre", orDefault(row.getGenre(), ""));
        payload.put("status", orDefault(row.getStatus(), "draft"));
        payload.put("created_at", row.getCreatedAt() != null ? row.getCreatedAt().toString() : null);
        payload.put("updated_at", row.getUpdatedAt() != null ? row.getUpdatedAt().toString() : null);
        return payload;
    }

    private String deriveStatus(JsonNode payload) {
        JsonNode episodes = payload.get("episodes");
        if (episodes == null || !episodes.isArray() || episodes.isEmpty()) return "draft";
        for (JsonNode ep : episodes) {
            if (!"ready".equals(ep.path("gen_status").asText(""))) return "draft";
        }
        return "ready";
    }

    private ObjectNode findEpisode(ObjectNode payload, String episodeId) {
        JsonNode episodes = payload.get("episodes");
        if (episodes == null || !episodes.isArray()) return null;
        for (JsonNode ep : episodes) {
            if (ep.isObject() && episodeId.equals(ep.path("id").asText())) return (ObjectNode) ep;
        }
        return null;
    }

    private ObjectNode readPayload(DramaInteractiveSeries row) {
        try {
            JsonNode n = row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
            return n.isObject() ? (ObjectNode) n : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
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

    private static String preview(String s) {
        if (s == null) return "";
        return s.length() > 40 ? s.substring(0, 40) + "…" : s;
    }
}
