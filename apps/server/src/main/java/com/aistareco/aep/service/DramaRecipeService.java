package com.aistareco.aep.service;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaRecipe;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaRecipeRepository;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 短剧「创意市场」配方 Recipe 服务（v0.73 抽 skill 飞轮，v0.75 双通道 + 内置手建）。
 *
 * 三条入市通道，统一落 {@link DramaRecipe}（origin 区分来源、status 走生命周期）：
 *   ① 用户自助：{@link #extractFromProject} → submitted（待运营审核）→ publish/reject。
 *   ② 运营邀请精选：{@link #inviteFromProject} → invited（待用户授权）→ {@link #respondInvite}
 *      approve → published / decline → declined。
 *   ③ 运营手建内置：{@link #createBuiltin} → 直接 published（origin=official，无作者）。
 *
 * 不静默兜底：端点 / prompt 未配置或 LLM 失败 → 带 code 报错（§8.0）。
 */
@Service
public class DramaRecipeService {

    private static final Logger log = LoggerFactory.getLogger(DramaRecipeService.class);
    private static final String OFFICIAL_OWNER = "__official__";

    private final DramaRecipeRepository repo;
    private final DramaProjectRepository projectRepo;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final AepUserRepository userRepo;
    private final NotificationPublisher notifier;
    private final ObjectMapper om;

    public DramaRecipeService(DramaRecipeRepository repo,
                              DramaProjectRepository projectRepo,
                              AiModelInvocationService invocation,
                              PromptService promptService,
                              AepUserRepository userRepo,
                              NotificationPublisher notifier,
                              ObjectMapper om) {
        this.repo = repo;
        this.projectRepo = projectRepo;
        this.invocation = invocation;
        this.promptService = promptService;
        this.userRepo = userRepo;
        this.notifier = notifier;
        this.om = om;
    }

    // ── 通道① 用户自助抽取 ────────────────────────────────────────────────────────

    /** 用户把自己已完成项目蒸馏成 Recipe（status=submitted，待运营审核）。返回 Recipe DTO。 */
    public JsonNode extractFromProject(String projectId, String userId) {
        DramaProject project = projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        DramaRecipe recipe = distillAndSave(project, "submitted", "extracted", resolveAuthorName(userId), null);
        log.info("[drama-recipe] extracted(self) id={} project={} user={}", recipe.getId(), projectId, userId);
        return toDto(recipe);
    }

    // ── 通道② 运营邀请精选用户作品 ────────────────────────────────────────────────

    /**
     * 运营「从用户作品精选」候选池：任意用户、已铺大纲的最近项目（运营侧浏览，不含官方内置项目）。
     * 每条标注作者与是否已抽过配方（去重提示）。
     */
    public List<JsonNode> listCandidates() {
        List<DramaProject> projects = projectRepo
                .findTop80ByDeletedAtIsNullAndStageGreaterThanEqualOrderByUpdatedAtDesc(2);
        List<String> ids = projects.stream().map(DramaProject::getId).collect(Collectors.toList());
        Set<String> withRecipe = new HashSet<>();
        if (!ids.isEmpty()) {
            for (DramaRecipe r : repo.findBySourceProjectIdInAndDeletedAtIsNull(ids)) {
                // 已被拒 / 已谢绝的不算占用，可重新精选
                if (r.getSourceProjectId() != null
                        && !"rejected".equals(r.getStatus()) && !"declined".equals(r.getStatus())) {
                    withRecipe.add(r.getSourceProjectId());
                }
            }
        }
        List<JsonNode> out = new ArrayList<>();
        for (DramaProject p : projects) {
            if (OFFICIAL_OWNER.equals(p.getOwnerUserId())) continue;
            ObjectNode o = om.createObjectNode();
            o.put("projectId", p.getId());
            o.put("title", orDefault(p.getTitle(), "未命名短剧"));
            o.put("type", orDefault(p.getType(), "短剧"));
            o.put("typeKey", orDefault(p.getTypeKey(), "custom"));
            o.put("ratio", orDefault(p.getRatio(), "9:16"));
            o.put("episodes", p.getEpisodes());
            o.put("stage", p.getStage());
            ObjectNode cover = om.createObjectNode();
            cover.put("from", orDefault(p.getCoverFrom(), "#f97316"));
            cover.put("to", orDefault(p.getCoverTo(), "#e11d48"));
            o.set("cover", cover);
            o.put("authorName", orDefault(resolveAuthorName(p.getOwnerUserId()), "用户"));
            o.put("ownerUserId", p.getOwnerUserId());
            o.put("hasRecipe", withRecipe.contains(p.getId()));
            o.put("updatedAt", p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : null);
            out.add(o);
        }
        return out;
    }

    /** 运营对某用户项目发起「邀请精选」→ status=invited，给作者发授权站内信。 */
    public JsonNode inviteFromProject(String projectId, String operatorId) {
        DramaProject project = projectRepo.findByIdAndDeletedAtIsNull(projectId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        String authorName = orDefault(resolveAuthorName(project.getOwnerUserId()), "用户");
        DramaRecipe recipe = distillAndSave(project, "invited", "featured", authorName, operatorId);
        notifier.notifyUser(project.getOwnerUserId(), Notification.NotificationType.CONTENT,
                "运营想把你的《" + orDefault(project.getTitle(), "短剧") + "》精选进创意市场",
                "平台运营希望把这部作品做成可复用的创意模板、公开供他人套用，并署名「来自你」。"
                        + "去「创意市场 · 我发布的创意」确认是否授权。");
        log.info("[drama-recipe] invited id={} project={} operator={} owner={}",
                recipe.getId(), projectId, operatorId, project.getOwnerUserId());
        return toDto(recipe);
    }

    /** 用户对运营邀请授权 / 谢绝。approve → published（consentAt 写入）；decline → declined。 */
    public JsonNode respondInvite(String recipeId, String userId, boolean approve) {
        DramaRecipe r = requireRecipe(recipeId);
        if (!userId.equals(r.getOwnerUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "DRAMA_RECIPE_NOT_OWNER", "只能处理对你自己作品的邀请。");
        }
        if (!"invited".equals(r.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_RECIPE_NOT_INVITED", "该配方不在「待授权」状态。");
        }
        OffsetDateTime now = OffsetDateTime.now();
        if (approve) {
            r.setStatus("published");
            r.setConsentAt(now);
            r.setPublishedAt(now);
            notifier.notifyAdmins(Notification.NotificationType.CONTENT,
                    "用户已授权精选", orDefault(r.getAuthorName(), "用户") + " 授权《" + orDefault(r.getTitle(), "短剧")
                            + "》进入创意市场。", userId);
        } else {
            r.setStatus("declined");
        }
        r.setUpdatedAt(now);
        repo.save(r);
        log.info("[drama-recipe] invite-response id={} user={} approve={}", recipeId, userId, approve);
        return toDto(r);
    }

    // ── 通道③ 运营手建内置创意 ────────────────────────────────────────────────────

    /** 运营手建内置创意（origin=official，直接 published）。body 见前端 BuiltinRecipeInput。 */
    public JsonNode createBuiltin(JsonNode body, String operatorId) {
        String title = text(body, "title");
        if (title == null || title.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_RECIPE_TITLE_REQUIRED", "请填写创意名称。");
        }
        ObjectNode payload = om.createObjectNode();
        payload.put("mainline", orDefault(text(body, "mainline"), ""));
        payload.set("beats", normalizeBeats(body.path("beats")));
        payload.set("characters", normalizeArchetypes(body.path("characters")));
        payload.set("hooks", body.path("hooks").isArray() ? body.get("hooks").deepCopy() : om.createArrayNode());
        payload.put("notes", orDefault(text(body, "notes"), ""));

        OffsetDateTime now = OffsetDateTime.now();
        DramaRecipe recipe = DramaRecipe.builder()
                .id("dr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(OFFICIAL_OWNER)
                .status("published")
                .origin("official")
                .title(title.trim())
                .summary(orDefault(text(body, "summary"), ""))
                .typeKey(orDefault(text(body, "typeKey"), "style"))
                .type(orDefault(text(body, "type"), "风格短片"))
                .ratio(orDefault(text(body, "ratio"), "9:16"))
                .episodes(body.path("episodes").asInt(1))
                .coverFrom(orDefault(text(body, "coverFrom"), "#7c3aed"))
                .coverTo(orDefault(text(body, "coverTo"), "#ec4899"))
                .useCount(0)
                .payloadJson(write(payload))
                .createdAt(now).updatedAt(now).publishedAt(now)
                .build();
        repo.save(recipe);
        log.info("[drama-recipe] builtin created id={} operator={} title={}", recipe.getId(), operatorId, title);
        return toDto(recipe);
    }

    // ── 蒸馏核心（通道①②共用） ──────────────────────────────────────────────────

    /** 调 LLM 把一部项目蒸馏成 Recipe 并落库。owner 取项目归属；invitedBy 非空=运营邀请。 */
    private DramaRecipe distillAndSave(DramaProject project, String status, String origin,
                                       String authorName, String invitedBy) {
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "抽取配方还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
        JsonNode data = readPayload(project);
        JsonNode info = data.path("projectInfo");
        JsonNode episodes = data.path("episodes");
        if (!episodes.isArray() || episodes.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_RECIPE_NEEDS_OUTLINE",
                    "这部短剧还没有分集大纲，先把大纲铺出来再抽成配方。");
        }

        String title = orDefault(text(info, "title"), orDefault(project.getTitle(), "未命名短剧"));
        String type = orDefault(text(info, "type"), orDefault(project.getType(), "短剧"));
        int eps = info.path("episodes").asInt(project.getEpisodes() > 0 ? project.getEpisodes() : 1);

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("title", title);
        vars.put("type", type);
        vars.put("episodes", String.valueOf(eps));
        vars.put("logline", orDefault(text(info, "logline"), ""));
        vars.put("mainline", orDefault(text(info, "mainline"), ""));
        vars.put("outline", summarizeOutline(episodes));
        vars.put("characters", summarizeCharacters(data.path("characters")));

        PromptService.ResolvedPrompt p = promptService.resolve(PromptService.KEY_DRAMA_RECIPE_EXTRACT);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "配方抽取的提示词尚未配置（promptKey=" + PromptService.KEY_DRAMA_RECIPE_EXTRACT
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        log.info("[drama-recipe] distill project={} owner={} invitedBy={} vars={}",
                project.getId(), project.getOwnerUserId(), invitedBy, vars);

        List<Map<String, String>> messages = new ArrayList<>();
        if (p.system() != null && !p.system().isBlank()) {
            messages.add(Map.of("role", "system", "content", p.system()));
        }
        messages.add(Map.of("role", "user", "content", PromptService.fill(p.userTemplate(), vars)));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", p.params().temperature() != null ? p.params().temperature() : 0.7);
        options.put("max_tokens", p.params().maxTokens() != null && p.params().maxTokens() > 0 ? p.params().maxTokens() : 4096);
        options.put("response_format", Map.of("type", "json_object"));

        AiModelInvocationService.AiModelResponse resp;
        try {
            resp = invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "配方抽取调用失败，请稍后重试。");
        }
        JsonNode root = tryReadJson(resp.content());
        if (root == null || !root.isObject()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "配方抽取返回的内容无法解析，请重试。");
        }

        ObjectNode payload = om.createObjectNode();
        payload.put("mainline", orDefault(text(root, "mainline"), ""));
        payload.set("beats", normalizeBeats(root.path("beats")));
        payload.set("characters", normalizeArchetypes(root.path("characters")));
        payload.set("hooks", root.path("hooks").isArray() ? root.get("hooks").deepCopy() : om.createArrayNode());
        payload.put("notes", orDefault(text(root, "notes"), ""));

        OffsetDateTime now = OffsetDateTime.now();
        DramaRecipe recipe = DramaRecipe.builder()
                .id("dr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(project.getOwnerUserId())
                .sourceProjectId(project.getId())
                .status(status)
                .origin(origin)
                .authorName(authorName)
                .invitedBy(invitedBy)
                .title(orDefault(text(root, "title"), title + " · 配方"))
                .summary(orDefault(text(root, "summary"), ""))
                .typeKey(orDefault(project.getTypeKey(), "custom"))
                .type(type)
                .ratio(orDefault(project.getRatio(), "9:16"))
                .episodes(eps)
                .coverFrom(orDefault(project.getCoverFrom(), "#f97316"))
                .coverTo(orDefault(project.getCoverTo(), "#e11d48"))
                .useCount(0)
                .payloadJson(write(payload))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(recipe);
        return recipe;
    }

    // ── 列表 / 审核 / 套用 ────────────────────────────────────────────────────────

    /** 我抽取/提交过的配方（含审核 / 邀请状态）。 */
    public List<JsonNode> listMine(String userId) {
        List<JsonNode> out = new ArrayList<>();
        for (DramaRecipe r : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) out.add(toDto(r));
        return out;
    }

    /** 已发布配方（创意市场）：按套用热度降序。任意已登录 drama 用户可见。 */
    public List<JsonNode> listPublished() {
        List<DramaRecipe> rows =
                new ArrayList<>(repo.findByStatusAndDeletedAtIsNullOrderByUpdatedAtDesc("published"));
        rows.sort((a, b) -> Integer.compare(b.getUseCount(), a.getUseCount()));
        List<JsonNode> out = new ArrayList<>();
        for (DramaRecipe r : rows) out.add(toDto(r));
        return out;
    }

    /** 运营审核队列：待审（submitted）。invited 走用户授权、不进此队列。 */
    public List<JsonNode> listForReview() {
        List<JsonNode> out = new ArrayList<>();
        for (DramaRecipe r : repo.findByStatusAndDeletedAtIsNullOrderByUpdatedAtDesc("submitted")) out.add(toDto(r));
        return out;
    }

    /** 运营发布（→ 进创意市场）。提交人非官方时给作者发上架站内信。 */
    public JsonNode publish(String recipeId) {
        DramaRecipe r = requireRecipe(recipeId);
        OffsetDateTime now = OffsetDateTime.now();
        r.setStatus("published");
        r.setPublishedAt(now);
        r.setReviewNote(null);
        r.setUpdatedAt(now);
        repo.save(r);
        if (!OFFICIAL_OWNER.equals(r.getOwnerUserId())) {
            notifier.notifyUser(r.getOwnerUserId(), Notification.NotificationType.CONTENT,
                    "你的创意已上架创意市场",
                    "《" + orDefault(r.getTitle(), "短剧") + "》已通过审核，进入创意市场公开可套用。");
        }
        log.info("[drama-recipe] published id={}", recipeId);
        return toDto(r);
    }

    /** 运营驳回（带理由）。给作者发驳回站内信。 */
    public JsonNode reject(String recipeId, String note) {
        DramaRecipe r = requireRecipe(recipeId);
        r.setStatus("rejected");
        r.setReviewNote(note == null ? "" : note);
        r.setUpdatedAt(OffsetDateTime.now());
        repo.save(r);
        if (!OFFICIAL_OWNER.equals(r.getOwnerUserId())) {
            notifier.notifyUser(r.getOwnerUserId(), Notification.NotificationType.CONTENT,
                    "创意未通过审核",
                    "《" + orDefault(r.getTitle(), "短剧") + "》暂未通过。"
                            + (note == null || note.isBlank() ? "" : "原因：" + note));
        }
        log.info("[drama-recipe] rejected id={} note={}", recipeId, note);
        return toDto(r);
    }

    /** 套用已发布配方 → 新建一个预填项目（mainline + 分集骨架 + 角色原型），返回 { projectId }。 */
    public JsonNode applyToNewProject(String recipeId, String userId) {
        DramaRecipe r = requireRecipe(recipeId);
        if (!"published".equals(r.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_RECIPE_NOT_PUBLISHED", "该配方尚未发布，不能套用。");
        }
        JsonNode data = readJson(r.getPayloadJson());
        OffsetDateTime now = OffsetDateTime.now();
        String pid = "dp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        ObjectNode pd = seedProjectFromRecipe(r, data);
        boolean hasBeats = data.path("beats").isArray() && data.path("beats").size() > 0;
        DramaProject p = DramaProject.builder()
                .id(pid).ownerUserId(userId)
                .title(orDefault(r.getTitle(), "未命名短剧"))
                .type(orDefault(r.getType(), "短剧"))
                .typeKey(orDefault(r.getTypeKey(), "custom"))
                .ratio(orDefault(r.getRatio(), "9:16"))
                .episodes(r.getEpisodes() > 0 ? r.getEpisodes() : 12)
                .progress(0).stage(hasBeats ? 2 : 1).mode("template")
                .coverFrom(orDefault(r.getCoverFrom(), "#f97316"))
                .coverTo(orDefault(r.getCoverTo(), "#e11d48"))
                .payloadJson(write(pd)).createdAt(now).updatedAt(now).build();
        projectRepo.save(p);
        r.setUseCount(r.getUseCount() + 1);
        r.setUpdatedAt(now);
        repo.save(r);
        log.info("[drama-recipe] applied recipe={} → project={} user={}", recipeId, pid, userId);
        ObjectNode out = om.createObjectNode();
        out.put("projectId", pid);
        return out;
    }

    private DramaRecipe requireRecipe(String id) {
        return repo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_RECIPE_NOT_FOUND", "配方不存在"));
    }

    /** 用 recipe 预填一份「空但合法」的 ProjectData：mainline + 分集大纲骨架 + 角色原型。 */
    private ObjectNode seedProjectFromRecipe(DramaRecipe r, JsonNode data) {
        ObjectNode root = om.createObjectNode();
        ObjectNode info = om.createObjectNode();
        info.put("title", orDefault(r.getTitle(), "未命名短剧"));
        info.put("type", orDefault(r.getType(), "短剧"));
        int eps = r.getEpisodes() > 0 ? r.getEpisodes() : 12;
        info.put("episodes", eps);
        info.put("duration", "每集 ~75 秒");
        info.put("ratio", orDefault(r.getRatio(), "9:16"));
        info.put("logline", "");
        info.put("mainline", data.path("mainline").asText(""));
        root.set("projectInfo", info);
        root.set("topicCards", om.createArrayNode());

        ArrayNode episodes = om.createArrayNode();
        int i = 1;
        for (JsonNode b : data.path("beats")) {
            if (!b.isObject()) continue;
            ObjectNode e = om.createObjectNode();
            e.put("no", b.path("no").asInt(i));
            e.put("hook", b.path("hook").asText(""));
            e.put("synopsis", b.path("beat").asText(""));
            e.put("beat", b.path("beat").asText(""));
            episodes.add(e);
            i++;
        }
        root.set("episodes", episodes);

        ArrayNode chars = om.createArrayNode();
        int ci = 1;
        for (JsonNode c : data.path("characters")) {
            if (!c.isObject()) continue;
            ObjectNode ch = om.createObjectNode();
            ch.put("id", "ch_" + ci);
            ch.put("name", c.path("archetype").asText("角色 " + ci));
            ch.put("role", "key".equals(c.path("role").asText()) ? "key" : "extra");
            ch.put("cast", "");
            ch.put("desc", c.path("desc").asText(""));
            ch.put("avatar", "a" + (((ci - 1) % 8) + 1));
            ch.put("bound", false);
            chars.add(ch);
            ci++;
        }
        root.set("characters", chars);

        ObjectNode script = om.createObjectNode();
        script.put("ep", 1);
        script.set("scenes", om.createArrayNode());
        root.set("script", script);
        ObjectNode sb = om.createObjectNode();
        sb.put("ep", 1);
        sb.set("scenes", om.createArrayNode());
        root.set("storyboard", sb);
        ObjectNode pp = om.createObjectNode();
        pp.put("ep", 1);
        pp.put("scene", "");
        pp.set("shots", om.createArrayNode());
        root.set("promptPack", pp);
        root.set("episodeDocs", om.createObjectNode());
        return root;
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    /** 解析用户展示名（displayName ?? username）。official / 缺失 → null。 */
    private String resolveAuthorName(String userId) {
        if (userId == null || userId.isBlank() || OFFICIAL_OWNER.equals(userId)) return null;
        AepUser u = userRepo.findById(userId).orElse(null);
        if (u == null) return "用户";
        if (u.getDisplayName() != null && !u.getDisplayName().isBlank()) return u.getDisplayName();
        if (u.getUsername() != null && !u.getUsername().isBlank()) return u.getUsername();
        return "用户";
    }

    private String summarizeOutline(JsonNode episodes) {
        StringBuilder sb = new StringBuilder();
        int n = 0;
        for (JsonNode e : episodes) {
            if (n++ >= 12) break;
            sb.append("第").append(e.path("no").asInt(n)).append("集");
            String hook = text(e, "hook");
            if (hook != null && !hook.isBlank()) sb.append("｜钩子：").append(hook);
            String syn = text(e, "synopsis");
            if (syn != null && !syn.isBlank()) sb.append("｜梗概：").append(syn);
            String beat = text(e, "beat");
            if (beat != null && !beat.isBlank()) sb.append("｜转折：").append(beat);
            sb.append("\n");
        }
        return sb.toString();
    }

    private String summarizeCharacters(JsonNode chars) {
        if (!chars.isArray() || chars.isEmpty()) return "（未设定）";
        StringBuilder sb = new StringBuilder();
        for (JsonNode c : chars) {
            sb.append("- ").append(orDefault(text(c, "name"), "角色"))
              .append("（").append("key".equals(text(c, "role")) ? "主角" : "配角").append("）：")
              .append(orDefault(text(c, "cast"), "")).append(" ").append(orDefault(text(c, "desc"), "")).append("\n");
        }
        return sb.toString();
    }

    private ArrayNode normalizeBeats(JsonNode beats) {
        ArrayNode out = om.createArrayNode();
        if (!beats.isArray()) return out;
        int i = 1;
        for (JsonNode b : beats) {
            if (!b.isObject()) continue;
            ObjectNode n = om.createObjectNode();
            n.put("no", b.path("no").asInt(i));
            n.put("hook", orDefault(text(b, "hook"), ""));
            n.put("beat", orDefault(text(b, "beat"), ""));
            out.add(n);
            i++;
        }
        return out;
    }

    private ArrayNode normalizeArchetypes(JsonNode chars) {
        ArrayNode out = om.createArrayNode();
        if (!chars.isArray()) return out;
        for (JsonNode c : chars) {
            if (!c.isObject()) continue;
            ObjectNode n = om.createObjectNode();
            String role = orDefault(text(c, "role"), "extra");
            n.put("role", role.equals("key") ? "key" : "extra");
            n.put("archetype", orDefault(text(c, "archetype"), ""));
            n.put("desc", orDefault(text(c, "desc"), ""));
            out.add(n);
        }
        return out;
    }

    private JsonNode toDto(DramaRecipe r) {
        ObjectNode o = om.createObjectNode();
        o.put("id", r.getId());
        o.put("ownerUserId", r.getOwnerUserId());
        o.put("sourceProjectId", r.getSourceProjectId());
        o.put("status", r.getStatus());
        o.put("origin", r.getOrigin());
        if (r.getAuthorName() != null && !r.getAuthorName().isBlank()) o.put("authorName", r.getAuthorName());
        if (r.getInvitedBy() != null && !r.getInvitedBy().isBlank()) o.put("invitedBy", r.getInvitedBy());
        o.put("title", orDefault(r.getTitle(), "未命名配方"));
        o.put("summary", orDefault(r.getSummary(), ""));
        o.put("typeKey", orDefault(r.getTypeKey(), "custom"));
        o.put("type", orDefault(r.getType(), "短剧"));
        o.put("ratio", orDefault(r.getRatio(), "9:16"));
        o.put("episodes", r.getEpisodes());
        ObjectNode cover = om.createObjectNode();
        cover.put("from", orDefault(r.getCoverFrom(), "#f97316"));
        cover.put("to", orDefault(r.getCoverTo(), "#e11d48"));
        o.set("cover", cover);
        if (r.getCoverImage() != null && !r.getCoverImage().isBlank()) {
            o.put("coverImage", r.getCoverImage());
        }
        o.put("useCount", r.getUseCount());
        if (r.getReviewNote() != null) o.put("reviewNote", r.getReviewNote());
        o.set("data", readJson(r.getPayloadJson()));
        o.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        o.put("updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null);
        o.put("publishedAt", r.getPublishedAt() != null ? r.getPublishedAt().toString() : null);
        o.put("consentAt", r.getConsentAt() != null ? r.getConsentAt().toString() : null);
        return o;
    }

    private JsonNode readPayload(DramaProject row) {
        return readJson(row.getPayloadJson());
    }

    private JsonNode readJson(String json) {
        try {
            return json != null ? om.readTree(json) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private JsonNode tryReadJson(String content) {
        if (content == null || content.isBlank()) return null;
        String s = content.trim();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) s = s.substring(nl + 1);
            if (s.endsWith("```")) s = s.substring(0, s.length() - 3);
            s = s.trim();
        }
        try {
            return om.readTree(s);
        } catch (Exception e) {
            int lb = s.indexOf('{');
            int end = s.lastIndexOf('}');
            if (lb >= 0 && end > lb) {
                try {
                    return om.readTree(s.substring(lb, end + 1));
                } catch (Exception ignore) {
                    return null;
                }
            }
            return null;
        }
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
