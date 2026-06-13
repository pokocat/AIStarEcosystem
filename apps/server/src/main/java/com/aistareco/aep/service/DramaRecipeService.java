package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaProject;
import com.aistareco.aep.model.DramaRecipe;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 短剧「可复用配方」Recipe 服务（v0.73，抽 skill 飞轮）。
 *
 * MVP 范围：用户把自己已完成的爆款项目反向蒸馏成 Recipe（status=submitted，待运营审核），
 * 运营 publish 后进创意库供他人套用。不静默兜底：端点 / prompt 未配置或 LLM 失败 → 带 code 报错。
 */
@Service
public class DramaRecipeService {

    private static final Logger log = LoggerFactory.getLogger(DramaRecipeService.class);

    private final DramaRecipeRepository repo;
    private final DramaProjectRepository projectRepo;
    private final AiModelInvocationService invocation;
    private final PromptService promptService;
    private final ObjectMapper om;

    public DramaRecipeService(DramaRecipeRepository repo,
                              DramaProjectRepository projectRepo,
                              AiModelInvocationService invocation,
                              PromptService promptService,
                              ObjectMapper om) {
        this.repo = repo;
        this.projectRepo = projectRepo;
        this.invocation = invocation;
        this.promptService = promptService;
        this.om = om;
    }

    /** 把某个已完成项目蒸馏成 Recipe（status=submitted）。返回 Recipe DTO。 */
    public JsonNode extractFromProject(String projectId, String userId) {
        DramaProject project = projectRepo.findByIdAndOwnerUserIdAndDeletedAtIsNull(projectId, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
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
        log.info("[drama-recipe] extract project={} user={} vars={}", projectId, userId, vars);

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
                .ownerUserId(userId)
                .sourceProjectId(projectId)
                .status("submitted")
                .origin("extracted")
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
        log.info("[drama-recipe] extracted id={} project={} user={} beats={}",
                recipe.getId(), projectId, userId, payload.path("beats").size());
        return toDto(recipe);
    }

    /** 我抽取/提交过的配方。 */
    public List<JsonNode> listMine(String userId) {
        List<JsonNode> out = new ArrayList<>();
        for (DramaRecipe r : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) out.add(toDto(r));
        return out;
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

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
        o.put("useCount", r.getUseCount());
        if (r.getReviewNote() != null) o.put("reviewNote", r.getReviewNote());
        o.set("data", readJson(r.getPayloadJson()));
        o.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        o.put("updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null);
        o.put("publishedAt", r.getPublishedAt() != null ? r.getPublishedAt().toString() : null);
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
