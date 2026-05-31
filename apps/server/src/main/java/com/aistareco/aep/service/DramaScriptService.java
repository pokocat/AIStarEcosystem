package com.aistareco.aep.service;

import com.aistareco.aep.dto.DramaDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DigitalIp;
import com.aistareco.aep.model.Drama;
import com.aistareco.aep.model.DramaScript;
import com.aistareco.aep.repository.DigitalIpRepository;
import com.aistareco.aep.repository.DramaRepository;
import com.aistareco.aep.repository.DramaScriptRepository;
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

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 短剧脚本服务（v0.43+，drama 子产品）。
 *
 * 三件事：
 *   1. 脚本 CRUD（按 ownerUserId 隔离 + 软删）；
 *   2. AI 起草短剧脚本（大模型，用途 DRAMA_SCRIPT_DRAFT，输出分场景 + 分镜 + 台词的结构化 JSON）；
 *   3. 由脚本生成短剧视频 —— 复用 celebrity 的视频任务管线（MaterialVideoJobService，
 *      异步 submit + poll；本服务只负责把脚本拼成视频提示词后委派）。
 *
 * 不静默兜底：大模型未配置 / 调用失败 / 输出无法解析 → 抛带 code 的明确错误，前端展示。
 */
@Service
public class DramaScriptService {

    private static final Logger log = LoggerFactory.getLogger(DramaScriptService.class);

    private final DramaScriptRepository repo;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final MaterialVideoJobService videoJobService;
    private final DigitalIpRepository digitalIpRepo;
    private final DramaRepository dramaRepo;
    private final ObjectMapper om;

    public DramaScriptService(DramaScriptRepository repo,
                              AiModelInvocationService invocation,
                              PromptService promptService,
                              MaterialVideoJobService videoJobService,
                              DigitalIpRepository digitalIpRepo,
                              DramaRepository dramaRepo,
                              ObjectMapper om) {
        this.repo = repo;
        this.invocation = invocation;
        this.promptService = promptService;
        this.videoJobService = videoJobService;
        this.digitalIpRepo = digitalIpRepo;
        this.dramaRepo = dramaRepo;
        this.om = om;
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    public List<JsonNode> listScripts(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaScript s : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId)) {
            out.add(toCard(s));
        }
        return out;
    }

    public JsonNode getScript(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .map(this::toCard)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_SCRIPT_NOT_FOUND", "短剧脚本不存在"));
    }

    public JsonNode saveScript(JsonNode body, String userId) {
        if (body == null || !body.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SCRIPT_BODY_REQUIRED", "缺少脚本内容");
        }
        String id = text(body, "id");
        OffsetDateTime now = OffsetDateTime.now();
        DramaScript row = (id != null && !id.isBlank())
                ? repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null)
                : null;
        if (row == null) {
            row = DramaScript.builder()
                    .id(id != null && !id.isBlank() ? id : "ds_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                    .ownerUserId(userId)
                    .createdAt(now)
                    .build();
        }
        ObjectNode payload = body.isObject() ? ((ObjectNode) body).deepCopy() : om.createObjectNode();
        payload.put("id", row.getId());
        // 显式保存即视为「已就绪」（不再是草稿），可直接用于生成。
        payload.put("status", "ready");
        row.setTitle(orDefault(text(body, "title"), "未命名短剧"));
        row.setGenre(orDefault(text(body, "genre"), "都市"));
        row.setDurationSec(body.path("duration_sec").asInt(60));
        row.setStatus("ready");
        // v0.45：剧集分组 / 项目回链落列（payload 缺字段时保留原值）
        if (body.has("series_id")) row.setSeriesId(text(body, "series_id"));
        if (body.has("episode_no")) row.setEpisodeNo(body.path("episode_no").asInt(row.getEpisodeNo()));
        if (body.has("drama_id")) row.setDramaId(text(body, "drama_id"));
        row.setPayloadJson(write(payload));
        row.setUpdatedAt(now);
        repo.save(row);
        return toCard(row);
    }

    public void deleteScript(String id, String userId) {
        DramaScript row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    // ── AI 起草 ─────────────────────────────────────────────────────────────────

    /** body: { theme, genre?, duration_sec?, count? } → 返回 count 个候选短剧脚本（未落库）。 */
    public List<JsonNode> aiDraft(JsonNode body, String userId) {
        PromptService.ResolvedPrompt prompt = promptService.resolve(AiModelPurpose.DRAMA_SCRIPT_DRAFT);
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "短剧脚本生成还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        if ("code".equals(prompt.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "短剧脚本起草的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_SCRIPT_DRAFT + "）。");
        }

        String theme = orDefault(text(body, "theme"), "");
        if (theme.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_THEME_REQUIRED", "请先填写短剧主题 / 一句话灵感");
        }
        String genre = orDefault(text(body, "genre"), "都市情感");
        int durationSec = body != null ? body.path("duration_sec").asInt(60) : 60;
        int count = clamp(body != null ? body.path("count").asInt(1) : 1, 1, 3);
        log.info("[drama-script] ai-draft start user={} genre={} durationSec={} count={} themeLength={}",
                userId, genre, durationSec, count, theme.length());

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("theme", theme);
        vars.put("genre", genre);
        vars.put("duration", String.valueOf(durationSec));
        vars.put("count", String.valueOf(count));
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
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                    "短剧脚本生成调用失败，请稍后重试。");
        }

        List<JsonNode> scripts = parseScripts(resp.content(), genre, durationSec);
        if (scripts.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "短剧脚本生成返回的内容无法解析，请重试或换个说法。");
        }
        log.info("[drama-script] ai-draft ok user={} theme='{}' got={} model={}",
                userId, preview(theme), scripts.size(), resp.modelUsed());
        return scripts;
    }

    // ── 生成短剧视频（复用 celebrity 视频任务管线） ──────────────────────────────

    /**
     * body: { script_id, count?, name?, variants?: [{ id, label, overrides? }] }
     * → 提交短剧视频任务。
     * 有 variants → 每个变体一条任务（带风格 override，作为 variant_config 透传，prompt 追加风格说明）；
     * 否则 → count 条同 prompt 任务。
     */
    public List<JsonNode> generateEpisodes(JsonNode body, String userId) {
        String scriptId = text(body, "script_id");
        if (scriptId == null || scriptId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SCRIPT_ID_REQUIRED", "请先选择要生成的短剧脚本");
        }
        DramaScript row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(scriptId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_SCRIPT_NOT_FOUND", "短剧脚本不存在"));
        JsonNode script = readScript(row);
        int durationSec = script.path("duration_sec").asInt(row.getDurationSec() > 0 ? row.getDurationSec() : 60);
        String aspect = orDefault(text(script, "aspect_ratio"), "9:16");
        String basePrompt = buildEpisodePrompt(script, userId);
        String baseName = orDefault(text(body, "name"), orDefault(row.getTitle(), "短剧片段"));

        ArrayNode items = om.createArrayNode();
        JsonNode variants = body != null ? body.get("variants") : null;
        if (variants != null && variants.isArray() && variants.size() > 0) {
            int idx = 1;
            for (JsonNode v : variants) {
                String label = orDefault(text(v, "label"), "第 " + idx + " 版");
                ObjectNode item = om.createObjectNode();
                item.put("script_id", scriptId);
                item.put("kind", "drama-episode");
                item.put("name", baseName + " · " + label);
                item.put("prompt", basePrompt + variantPromptSuffix(v));
                item.put("duration_sec", durationSec);
                item.put("aspect_ratio", aspect);
                if (v.has("overrides") && !v.get("overrides").isNull()) item.set("variant_config", v.get("overrides"));
                items.add(item);
                idx++;
            }
        } else {
            int count = clamp(body != null ? body.path("count").asInt(1) : 1, 1, 5);
            for (int i = 0; i < count; i++) {
                ObjectNode item = om.createObjectNode();
                item.put("script_id", scriptId);
                item.put("kind", "drama-episode");
                item.put("name", count > 1 ? baseName + " · 第 " + (i + 1) + " 版" : baseName);
                item.put("prompt", basePrompt);
                item.put("duration_sec", durationSec);
                item.put("aspect_ratio", aspect);
                items.add(item);
            }
        }
        log.info("[drama-script] generate-episodes start user={} scriptId={} jobs={} durationSec={} promptLength={}",
                userId, scriptId, items.size(), durationSec, basePrompt.length());
        ObjectNode submitBody = om.createObjectNode();
        submitBody.set("items", items);
        List<JsonNode> jobs = videoJobService.submit(submitBody, userId);
        log.info("[drama-script] generate-episodes queued user={} scriptId={} jobs={}",
                userId, scriptId, jobs.size());
        return jobs;
    }

    /** 一部多集短剧的所有集（按集号升序）。 */
    public List<JsonNode> listSeriesEpisodes(String seriesId, String userId) {
        if (seriesId == null || seriesId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaScript s : repo.findByOwnerUserIdAndSeriesIdAndDeletedAtIsNullOrderByEpisodeNoAsc(userId, seriesId)) {
            out.add(toCard(s));
        }
        return out;
    }

    /** 单镜 AI 改写：body { script_id, scene_index, prompt? } → 返回改写后的单个 scene JSON（未落库）。 */
    public JsonNode rewriteScene(JsonNode body, String userId) {
        String scriptId = text(body, "script_id");
        if (scriptId == null || scriptId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SCRIPT_ID_REQUIRED", "请先选择要改写的短剧脚本");
        }
        DramaScript row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(scriptId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_SCRIPT_NOT_FOUND", "短剧脚本不存在"));
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "单镜改写还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        JsonNode script = readScript(row);
        JsonNode scenes = script.get("scenes");
        int sceneIndex = body != null ? body.path("scene_index").asInt(-1) : -1;
        if (scenes == null || !scenes.isArray() || sceneIndex < 0 || sceneIndex >= scenes.size()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SCENE_INDEX_INVALID", "镜头序号无效");
        }
        JsonNode scene = scenes.get(sceneIndex);
        String prompt = orDefault(text(body, "prompt"), "让这一镜更有张力、钩子更强、台词更自然");

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "你是竖屏短剧编剧。改写用户给定的单个分镜，保持 JSON 结构不变，只输出该镜的 JSON 对象。"
                        + "字段：heading（时间·地点·内外）、summary（动作/转折）、shot（画面/分镜怎么拍）、"
                        + "dialogue（台词/旁白，没有就空字符串）、duration_sec（秒）、shot_type（wide|medium|close|extreme_close）、"
                        + "camera_move（static|push|pull|pan|handheld）、gen_voice（是否配音 true/false）。"));
        messages.add(Map.of("role", "user", "content",
                "原镜 JSON：" + safeWrite(scene) + "\n改写要求：" + prompt + "\n只输出改写后的单个 JSON 对象。"));

        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", 0.9);
        options.put("max_tokens", 1024);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "单镜改写调用失败，请稍后重试。");
        }
        JsonNode parsed = tryReadJson(resp.content());
        if (parsed == null || !parsed.isObject()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "单镜改写返回的内容无法解析，请重试。");
        }
        log.info("[drama-script] rewrite-scene ok user={} scriptId={} sceneIndex={} model={}",
                userId, scriptId, sceneIndex, resp.modelUsed());
        return parsed;
    }

    /**
     * 成片归入项目流水线：据短剧脚本创建（或复用）一个 Drama 项目，回写 drama_id。
     * 幂等：脚本已绑定且 Drama 存在 → 返回已存在项目。
     */
    public DramaDto publishToProject(String scriptId, String userId) {
        DramaScript row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(scriptId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_SCRIPT_NOT_FOUND", "短剧脚本不存在"));
        if (row.getDramaId() != null && !row.getDramaId().isBlank()) {
            Drama existing = dramaRepo.findById(row.getDramaId()).orElse(null);
            if (existing != null) return DramaDto.from(existing);
        }
        JsonNode script = readScript(row);
        boolean hasReadyVideo = listEpisodeJobs(userId, scriptId).stream()
                .anyMatch(j -> "ready".equals(text(j, "status")));
        int episodes = 1;
        if (row.getSeriesId() != null && !row.getSeriesId().isBlank()) {
            int n = repo.findByOwnerUserIdAndSeriesIdAndDeletedAtIsNullOrderByEpisodeNoAsc(userId, row.getSeriesId()).size();
            if (n > 0) episodes = n;
        }
        String role = characterNames(script);
        Instant now = Instant.now();
        Drama drama = Drama.builder()
                .id("d-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .title(orDefault(row.getTitle(), "未命名短剧"))
                .genre(orDefault(row.getGenre(), ""))
                .episodes(episodes)
                .role(role)
                .status(hasReadyVideo ? Drama.DramaStatus.RELEASED : Drama.DramaStatus.POST_PRODUCTION)
                .views(0L).revenue(0L).rating(0.0)
                .releaseDate(hasReadyVideo ? now : null)
                .build();
        dramaRepo.save(drama);
        // 回写脚本：列 + payload
        row.setDramaId(drama.getId());
        ObjectNode payload = script.isObject() ? (ObjectNode) script : om.createObjectNode();
        payload.put("drama_id", drama.getId());
        row.setPayloadJson(write(payload));
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
        log.info("[drama-script] publish-to-project user={} scriptId={} dramaId={} status={}",
                userId, scriptId, drama.getId(), drama.getStatus());
        return DramaDto.from(drama);
    }

    public List<JsonNode> listEpisodeJobs(String userId, String scriptId) {
        return videoJobService.listJobs(userId, scriptId, null);
    }

    public JsonNode getEpisodeJob(String id, String userId) {
        return videoJobService.getJob(id, userId);
    }

    /**
     * 把一段短剧脚本拼成视频大模型提示词（v0.45 增强）：
     * 整体风格 + 角色设定（含绑定虚拟演员形象）+ 分镜（景别/运镜/出场角色/配音 or 字幕）。
     */
    String buildEpisodePrompt(JsonNode script, String userId) {
        StringBuilder sb = new StringBuilder();
        int durationSec = script.path("duration_sec").asInt(60);
        String aspect = orDefault(text(script, "aspect_ratio"), "9:16");
        sb.append("请生成一条 ").append(durationSec).append("s、比例 ").append(aspect).append(" 的竖屏短剧视频片段，")
                .append("风格电影感、画面稳定清晰、表演到位、无水印。\n");
        String title = text(script, "title");
        String genre = text(script, "genre");
        String logline = text(script, "logline");
        if (title != null) sb.append("【剧名】").append(title).append(genre != null ? "（" + genre + "）" : "").append("\n");
        if (logline != null) sb.append("【一句话简介】").append(logline).append("\n");

        JsonNode style = script.get("style");
        if (style != null && style.isObject()) {
            List<String> parts = new ArrayList<>();
            addPart(parts, "视觉", text(style, "visual"));
            addPart(parts, "色调", text(style, "palette"));
            addPart(parts, "节奏", text(style, "pace"));
            if (!parts.isEmpty()) sb.append("【整体风格】").append(String.join("；", parts)).append("\n");
        }

        Map<String, String> charNames = new LinkedHashMap<>();
        JsonNode characters = script.get("characters");
        if (characters != null && characters.isArray() && characters.size() > 0) {
            sb.append("【角色设定】\n");
            for (JsonNode ch : characters) {
                String cid = text(ch, "id");
                String name = orDefault(text(ch, "name"), "角色");
                String roleName = text(ch, "role");
                String appearance = resolveAppearance(ch, userId);
                if (cid != null) charNames.put(cid, name);
                sb.append("  · ").append(name);
                if (roleName != null && !roleName.isBlank()) sb.append("（").append(roleName).append("）");
                if (appearance != null && !appearance.isBlank()) sb.append("：").append(appearance);
                sb.append("\n");
            }
        }

        JsonNode scenes = script.get("scenes");
        if (scenes != null && scenes.isArray() && scenes.size() > 0) {
            sb.append("【分镜脚本】（共 ").append(scenes.size()).append(" 镜）\n");
            int i = 1;
            for (JsonNode sc : scenes) {
                String heading = orDefault(text(sc, "heading"), "镜头");
                int dur = sc.path("duration_sec").asInt(0);
                String summary = orDefault(text(sc, "summary"), "");
                String dialogue = orDefault(text(sc, "dialogue"), "");
                String shot = orDefault(text(sc, "shot"), "");
                String shotType = shotTypeLabel(text(sc, "shot_type"));
                String cameraMove = cameraMoveLabel(text(sc, "camera_move"));
                boolean genVoice = sc.path("gen_voice").asBoolean(true);
                sb.append("  镜").append(i++).append(" · ").append(heading);
                if (dur > 0) sb.append(" · ").append(dur).append("s");
                JsonNode cids = sc.get("character_ids");
                if (cids != null && cids.isArray() && cids.size() > 0 && !charNames.isEmpty()) {
                    List<String> names = new ArrayList<>();
                    for (JsonNode cidNode : cids) {
                        String nm = charNames.get(cidNode.asText());
                        if (nm != null) names.add(nm);
                    }
                    if (!names.isEmpty()) sb.append(" · 出场：").append(String.join("、", names));
                }
                sb.append("：").append(summary);
                if (!shot.isBlank()) sb.append("｜画面：").append(shot);
                String lens = (shotType + " " + cameraMove).trim();
                if (!lens.isBlank()) sb.append("｜镜头：").append(lens);
                if (!dialogue.isBlank()) sb.append(genVoice ? "｜台词(配音)：" : "｜字幕(无配音)：").append(dialogue);
                sb.append("\n");
            }
        }
        sb.append("要求：镜头语言连贯、符合短剧快节奏；台词自然口语；情绪与冲突到位；结尾留钩子。");
        return sb.toString();
    }

    /** 变体风格 override → 追加到 prompt 末尾的「本版风格」说明。 */
    private String variantPromptSuffix(JsonNode v) {
        JsonNode ov = v == null ? null : v.get("overrides");
        if (ov == null || !ov.isObject()) return "";
        List<String> parts = new ArrayList<>();
        addPart(parts, "基调", text(ov, "tone"));
        JsonNode style = ov.get("style");
        if (style != null && style.isObject()) {
            addPart(parts, "视觉", text(style, "visual"));
            addPart(parts, "色调", text(style, "palette"));
            addPart(parts, "节奏", text(style, "pace"));
        }
        return parts.isEmpty() ? "" : "\n【本版风格】" + String.join("；", parts);
    }

    /** 角色形象：优先用 character.appearance；为空且绑定了演员（cast_id）则从该用户拥有的 DigitalIp 合成。 */
    private String resolveAppearance(JsonNode character, String userId) {
        String appearance = text(character, "appearance");
        if (appearance != null && !appearance.isBlank()) return appearance;
        String castId = text(character, "cast_id");
        if (castId == null || castId.isBlank()) return null;
        DigitalIp ip = digitalIpRepo.findById(castId).orElse(null);
        if (ip == null || (userId != null && !userId.equals(ip.getOwnerUserId()))) return null;
        return synthesizeAppearance(ip);
    }

    private String synthesizeAppearance(DigitalIp ip) {
        List<String> parts = new ArrayList<>();
        if (ip.getName() != null) parts.add("演员「" + ip.getName() + "」");
        Map<String, Object> p = ip.getIncubationParams();
        if (p != null) {
            appendParam(parts, p, "age", "年龄");
            appendParam(parts, p, "height", "身高");
            appendParam(parts, p, "faceStyle", "脸型");
            appendParam(parts, p, "fashionStyle", "穿搭");
            appendParam(parts, p, "temperament", "气质");
        }
        String bio = ip.getBio();
        if (bio != null && !bio.isBlank()) parts.add(bio.length() > 60 ? bio.substring(0, 60) : bio);
        return String.join("，", parts);
    }

    private static void appendParam(List<String> parts, Map<String, Object> p, String key, String label) {
        Object v = p.get(key);
        if (v != null && !String.valueOf(v).isBlank()) parts.add(label + "：" + v);
    }

    private static void addPart(List<String> parts, String label, String value) {
        if (value != null && !value.isBlank()) parts.add(label + "：" + value);
    }

    private String characterNames(JsonNode script) {
        JsonNode characters = script.get("characters");
        if (characters == null || !characters.isArray()) return "";
        List<String> names = new ArrayList<>();
        for (JsonNode ch : characters) {
            String name = text(ch, "name");
            if (name != null && !name.isBlank()) names.add(name);
        }
        return String.join(" / ", names);
    }

    private static String shotTypeLabel(String t) {
        if (t == null) return "";
        return switch (t) {
            case "wide" -> "远景";
            case "medium" -> "中景";
            case "close" -> "近景";
            case "extreme_close" -> "特写";
            default -> "";
        };
    }

    private static String cameraMoveLabel(String m) {
        if (m == null) return "";
        return switch (m) {
            case "static" -> "固定机位";
            case "push" -> "推镜";
            case "pull" -> "拉镜";
            case "pan" -> "摇镜";
            case "handheld" -> "手持";
            default -> "";
        };
    }

    private String safeWrite(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return "{}";
        }
    }

    // ── 解析 / 工具 ──────────────────────────────────────────────────────────────

    private List<JsonNode> parseScripts(String content, String genre, int durationSec) {
        List<JsonNode> out = new ArrayList<>();
        JsonNode root = tryReadJson(content);
        if (root == null) return out;
        JsonNode arr = null;
        if (root.isArray()) {
            arr = root;
        } else if (root.has("scripts") && root.get("scripts").isArray()) {
            arr = root.get("scripts");
        } else if (root.has("scenes")) {
            // 模型直接返回了单个脚本对象
            ArrayNode wrap = om.createArrayNode();
            wrap.add(root);
            arr = wrap;
        }
        if (arr == null) return out;
        for (JsonNode s : arr) {
            if (!s.isObject()) continue;
            ObjectNode script = ((ObjectNode) s).deepCopy();
            if (!script.hasNonNull("id")) {
                script.put("id", "ds_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
            }
            if (!script.hasNonNull("genre")) script.put("genre", genre);
            if (!script.hasNonNull("duration_sec")) script.put("duration_sec", durationSec);
            if (!script.hasNonNull("status")) script.put("status", "draft");
            // scenes 必须存在且非空才算有效脚本
            JsonNode scenes = script.get("scenes");
            if (scenes == null || !scenes.isArray() || scenes.size() == 0) continue;
            out.add(script);
        }
        return out;
    }

    private JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        // 去 markdown 围栏
        if (s.startsWith("```")) {
            int firstNl = s.indexOf('\n');
            if (firstNl >= 0) s = s.substring(firstNl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.trim();
        }
        try {
            return om.readTree(s);
        } catch (Exception e) {
            // 尝试截取首个 { ... } 或 [ ... ]
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

    private JsonNode readScript(DramaScript row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private JsonNode toCard(DramaScript row) {
        ObjectNode card;
        try {
            JsonNode base = row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
            card = base.isObject() ? ((ObjectNode) base).deepCopy() : om.createObjectNode();
        } catch (Exception e) {
            card = om.createObjectNode();
        }
        card.put("id", row.getId());
        card.put("title", orDefault(row.getTitle(), "未命名短剧"));
        card.put("genre", orDefault(row.getGenre(), ""));
        card.put("duration_sec", row.getDurationSec());
        card.put("status", orDefault(row.getStatus(), "ready"));
        card.put("series_id", row.getSeriesId());
        card.put("episode_no", row.getEpisodeNo());
        card.put("drama_id", row.getDramaId());
        card.put("created_at", row.getCreatedAt() != null ? row.getCreatedAt().toString() : null);
        card.put("updated_at", row.getUpdatedAt() != null ? row.getUpdatedAt().toString() : null);
        return card;
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
