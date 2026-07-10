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
    private final PromptService promptService;
    private final CreditService creditService;
    private final PlatformConfigService configs;
    private final com.aistareco.aep.service.storage.StorageQuotaService storage;
    private final com.aistareco.aep.service.cdn.CdnUrlSigner signer;
    private final DramaReferenceAssetService assets;
    private final ObjectMapper om;

    public DramaProjectService(DramaProjectRepository repo,
                               AiModelInvocationService invocation,
                               PromptService promptService,
                               CreditService creditService,
                               PlatformConfigService configs,
                               com.aistareco.aep.service.storage.StorageQuotaService storage,
                               com.aistareco.aep.service.cdn.CdnUrlSigner signer,
                               DramaReferenceAssetService assets,
                               ObjectMapper om) {
        this.repo = repo;
        this.invocation = invocation;
        this.promptService = promptService;
        this.creditService = creditService;
        this.configs = configs;
        this.storage = storage;
        this.signer = signer;
        this.assets = assets;
        this.om = om;
    }

    /** 扣费包裹（v0.66）：hold → 生成 → commit；失败 release 不扣。价格 0 = 免费跳过。 */
    private <T> T withCharge(String userId, long price, String desc, java.util.function.Supplier<T> work) {
        if (price <= 0) return work.get();
        String ref = "da_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        creditService.hold(userId, price, "DRAMA_AI", ref, desc);
        try {
            T out = work.get();
            creditService.commitHold("DRAMA_AI", ref, price, desc);
            return out;
        } catch (RuntimeException e) {
            try {
                creditService.releaseHold("DRAMA_AI", ref, desc + " · 失败释放");
            } catch (Exception ignore) { /* 释放失败仅记账问题，不掩盖原始错误 */ }
            throw e;
        }
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
        // C-2：懒回填角色/场景实体（老项目文档非空但无实体行时建；幂等）。
        assets.ensureBackfilled(row.getId(), userId, readPayload(row));
        return toDetail(row);
    }

    /**
     * C-2 三视图端点：角色一键生成 正/侧/全身 参考图集。
     * body:{ angles?, ratio?, appearanceHint? } → { characterId, refImages, cost }。
     */
    public JsonNode generateCharacterReferenceSheet(String projectId, String charId, JsonNode body, String userId) {
        return assets.generateReferenceSheet(projectId, charId, body, userId);
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
                        orDefault(text(body, "logline"), ""), orDefault(text(body, "mainline"), ""),
                        "interactive".equals(mode))))
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
        // v0.79：payload 带 interactive.enabled（新建互动剧 / 从线性转换）→ 卡片 mode 同步为 interactive。
        if (data.path("interactive").path("enabled").asBoolean(false)) row.setMode("interactive");
        row.setPayloadJson(write(data));
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
        // C-2 双写（§6.1）：只 upsert 角色/场景实体表，不重写 payloadJson——渲染真值走实体表，绕开文档级并发。
        assets.syncFromDoc(row.getId(), userId, data);
        return toDetail(row);
    }

    public void deleteProject(String id, String userId) {
        DramaProject row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    // ── 回收站（软删 → 保留期 → 到期物理删除） ───────────────────────────────────
    // 软删（移入回收站）复用上面的 deleteProject。镜像 dap 数字人回收站约定。

    /** 软删项目在回收站保留的天数，到期后由定时任务物理删除。 */
    public static final int TRASH_RETENTION_DAYS = 30;

    /** 回收站列表：当前用户已软删的项目（含 deletedAt / purgeAt / daysLeft）。 */
    public List<JsonNode> listTrash(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaProject p : repo.findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(userId)) {
            out.add(toTrashItem(p));
        }
        return out;
    }

    /** 从回收站恢复：清除 deletedAt，回到工坊列表。→ { meta, data }。 */
    public JsonNode restoreProject(String id, String userId) {
        DramaProject row = repo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        if (row.getDeletedAt() != null) {
            row.setDeletedAt(null);
            row.setUpdatedAt(OffsetDateTime.now());
            repo.save(row);
        }
        return toDetail(row);
    }

    /** 彻底删除（物理）：必须已在回收站。 */
    public void purgeProject(String id, String userId) {
        DramaProject row = repo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
        if (row.getDeletedAt() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_NOT_IN_TRASH", "请先移入回收站再彻底删除");
        }
        repo.delete(row);
        storage.releaseByRef("drama", id); // 释放该项目占用的存储（成片等）
        assets.purgeByProject(id);         // C-2：清角色/场景实体行
    }

    /** 定时任务：物理删除软删超过保留期的项目。返回清理条数。 */
    public int purgeExpiredTrash() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(TRASH_RETENTION_DAYS);
        List<DramaProject> expired = repo.findByDeletedAtBefore(cutoff);
        int done = 0;
        for (DramaProject p : expired) {
            try {
                repo.delete(p);
                storage.releaseByRef("drama", p.getId());
                assets.purgeByProject(p.getId());
                done++;
            } catch (Exception e) {
                log.warn("[drama-trash] purge expired failed id={}: {}", p.getId(), e.getMessage());
            }
        }
        if (!expired.isEmpty()) {
            log.info("[drama-trash] purge expired: {}/{} cleaned (cutoff={})", done, expired.size(), cutoff);
        }
        return done;
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

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("title", title);
        vars.put("type", type);
        vars.put("count", String.valueOf(count));
        vars.put("loglineClause", logline.isBlank() ? "" : "一句话简介：" + logline + "。");
        vars.put("mainlineClause", mainline.isBlank() ? "" : "主线：" + mainline + "。");
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_OUTLINE, vars, 0.9);

        long price = count <= 6
                ? configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_OUTLINE_TRIAL, 6)
                : configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_OUTLINE_FULL, 18);
        return withCharge(userId, price, "短剧大纲 AI 起草（" + count + " 集）", () -> {
            AiModelInvocationService.AiModelResponse resp = invoke(pc);
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
        });
    }

    // ── 剧集脚本（分场分镜）AI 起草 ────────────────────────────────────────────────

    /**
     * 按本集剧情把整集重写为「分场 + 分镜」。body: { ep, plot, style?, cast?[] }
     * → { scenes: ScriptScene[], boardScenes: BoardScene[] }（未落库，前端合并后 PUT 保存）。
     */
    public JsonNode epscriptAiDraft(String id, JsonNode body, String userId) {
        DramaProject row = requireOwned(id, userId);
        requireLlm();
        int ep = body != null ? body.path("ep").asInt(1) : 1;
        String plot = orDefault(text(body, "plot"), "");
        if (plot.isBlank()) {
            JsonNode outline = readPayload(row).path("episodes");
            for (JsonNode e : outline) {
                if (e.path("no").asInt() == ep) plot = orDefault(text(e, "content"), e.path("synopsis").asText(""));
            }
        }
        if (plot.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PLOT_REQUIRED", "请先填写本集剧情再生成分场分镜");
        }
        String style = orDefault(text(body, "style"), "");
        StringBuilder castSb = new StringBuilder();
        if (body != null && body.get("cast") != null && body.get("cast").isArray()) {
            for (JsonNode c : body.get("cast")) {
                if (castSb.length() > 0) castSb.append("、");
                castSb.append(c.isObject() ? c.path("name").asText("") : c.asText(""));
            }
        }

        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("ep", String.valueOf(ep));
        vars.put("plot", plot);
        vars.put("styleClause", style.isBlank() ? "" : "作品风格：" + style + "。");
        vars.put("castClause", castSb.length() == 0 ? "" : "出场人物：" + castSb + "。");
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_EPSCRIPT, vars, 0.85);

        return withCharge(userId,
                configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_EPSCRIPT, 10),
                "整集分场分镜 AI 重写（第 " + ep + " 集）", () -> {
        JsonNode root = callJson(pc);
        JsonNode scenesIn = root.path("scenes");
        if (!scenesIn.isArray() || scenesIn.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                    "分场分镜生成返回的内容无法解析，请重试或换个说法。");
        }
        ArrayNode scriptScenes = om.createArrayNode();
        ArrayNode boardScenes = om.createArrayNode();
        int si = 1;
        for (JsonNode sc : scenesIn) {
            if (!sc.isObject()) continue;
            String sceneId = "sc_" + ep + "_" + si;
            ObjectNode ss = om.createObjectNode();
            ss.put("id", sceneId);
            ss.put("place", orDefault(text(sc, "place"), "内景 · 未命名场景"));
            ss.put("mood", orDefault(text(sc, "mood"), ""));
            ss.put("action", orDefault(text(sc, "action"), ""));
            ArrayNode lines = om.createArrayNode();
            if (sc.get("lines") != null && sc.get("lines").isArray()) {
                for (JsonNode l : sc.get("lines")) {
                    ObjectNode line = om.createObjectNode();
                    line.put("who", orDefault(text(l, "who"), "旁白"));
                    line.put("text", orDefault(text(l, "text"), ""));
                    lines.add(line);
                }
            }
            ss.set("lines", lines);
            scriptScenes.add(ss);

            ObjectNode bs = om.createObjectNode();
            bs.put("id", sceneId);
            ArrayNode shots = om.createArrayNode();
            int no = 1;
            if (sc.get("shots") != null && sc.get("shots").isArray()) {
                for (JsonNode sh : sc.get("shots")) {
                    shots.add(normalizeShot(sh, sceneId, no++));
                }
            }
            bs.set("shots", shots);
            boardScenes.add(bs);
            si++;
        }
        log.info("[drama-project] epscript ai-draft ok user={} id={} ep={} scenes={}", userId, id, ep, scriptScenes.size());
        ObjectNode out = om.createObjectNode();
        out.set("scenes", scriptScenes);
        out.set("boardScenes", boardScenes);
        return out;
        });
    }

    /** 把单场（场面描述 + 台词）拆成镜头表。body: { sceneId, place?, action, lines?[], style? } → { shots: BoardShot[] } */
    public JsonNode splitSceneShots(String id, JsonNode body, String userId) {
        requireOwned(id, userId);
        requireLlm();
        String action = orDefault(text(body, "action"), "");
        String sceneId = orDefault(text(body, "sceneId"), "sc");
        if (action.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SCENE_REQUIRED", "请先写这场的场面描述再拆镜");
        }
        StringBuilder linesSb = new StringBuilder();
        if (body.get("lines") != null && body.get("lines").isArray()) {
            for (JsonNode l : body.get("lines")) {
                linesSb.append(l.path("who").asText("旁白")).append("：").append(l.path("text").asText("")).append("\n");
            }
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("place", orDefault(text(body, "place"), ""));
        vars.put("action", action);
        vars.put("linesClause", linesSb.length() == 0 ? "" : "台词：\n" + linesSb);
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_SPLIT_SCENE, vars, 0.8);

        return withCharge(userId,
                configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_SPLIT_SCENE, 6),
                "单场拆镜 AI", () -> {
            JsonNode root = callJson(pc);
            JsonNode shotsIn = root.path("shots");
            if (!shotsIn.isArray() || shotsIn.isEmpty()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "拆镜返回的内容无法解析，请重试。");
            }
            ArrayNode shots = om.createArrayNode();
            int no = 1;
            for (JsonNode sh : shotsIn) shots.add(normalizeShot(sh, sceneId, no++));
            ObjectNode out = om.createObjectNode();
            out.set("shots", shots);
            return out;
        });
    }

    /**
     * 镜头分解（v0.97 P2，借鉴 ViMax storyboard_artist）：单镜画面 → 首/末帧静态快照 + 运动描述 + 变化等级，
     * 供首+尾帧双关键帧 i2v（seedance），多镜一致性更稳。
     * body: { desc, cast?:[名] } → { ffDesc, ffChars[], lfDesc, lfChars[], motionDesc, variationType, variationReason }（未落库）。
     */
    public JsonNode decomposeShot(String id, JsonNode body, String userId) {
        DramaProject row = requireOwned(id, userId);
        requireLlm();
        String visual = orDefault(text(body, "desc"), "");
        if (visual.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHOT_REQUIRED", "请先填写镜头画面再做镜头分解");
        }
        // 已知人物名集合：项目角色 ∪ 本镜传入 cast —— 用于校验 ff/lf_chars 不编造（不存在的名字过滤掉）。
        java.util.LinkedHashSet<String> known = new java.util.LinkedHashSet<>();
        for (JsonNode c : readPayload(row).path("characters")) {
            String n = c.path("name").asText("");
            if (!n.isBlank()) known.add(n);
        }
        StringBuilder castSb = new StringBuilder();
        if (body != null && body.get("cast") != null && body.get("cast").isArray()) {
            for (JsonNode c : body.get("cast")) {
                String n = c.isObject() ? c.path("name").asText("") : c.asText("");
                if (!n.isBlank()) {
                    known.add(n);
                    if (castSb.length() > 0) castSb.append("、");
                    castSb.append(n);
                }
            }
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("visual", visual);
        vars.put("charactersClause", castSb.length() > 0
                ? "出场人物：" + castSb + "。"
                : (known.isEmpty() ? "" : "出场人物：" + String.join("、", known) + "。"));
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_DECOMPOSE, vars, 0.7);

        return withCharge(userId,
                configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_DECOMPOSE, 3),
                "镜头分解（首/末帧 + 运动）", () -> {
            JsonNode root = callJson(pc);
            String ffDesc = text(root, "ff_desc");
            String motionDesc = text(root, "motion_desc");
            if ((ffDesc == null || ffDesc.isBlank()) && (motionDesc == null || motionDesc.isBlank())) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "镜头分解返回的内容无法解析，请重试。");
            }
            String vt = orDefault(text(root, "variation_type"), "small");
            ObjectNode out = om.createObjectNode();
            out.put("ffDesc", orDefault(ffDesc, ""));
            out.put("lfDesc", orDefault(text(root, "lf_desc"), ""));
            out.put("motionDesc", orDefault(motionDesc, ""));
            out.put("variationType", (vt.equals("large") || vt.equals("medium")) ? vt : "small");
            out.put("variationReason", orDefault(text(root, "variation_reason"), ""));
            out.set("ffChars", filterKnownNames(root.path("ff_chars"), known));
            out.set("lfChars", filterKnownNames(root.path("lf_chars"), known));
            log.info("[drama-project] decompose ok user={} id={} variation={}", userId, id, vt);
            return out;
        });
    }

    /**
     * 行级「就地改写本镜」（v0.97 P5，对齐 ViMax design_storyboard 逐镜可控）：按指令只改这一个镜头。
     * body: { desc, size?, move?, line?:{who,text}, instruction, cast?:[名] } → { desc, size, move, line }（未落库）。
     */
    public JsonNode rewriteShot(String id, JsonNode body, String userId) {
        requireOwned(id, userId);
        requireLlm();
        String visual = orDefault(text(body, "desc"), "");
        String instruction = orDefault(text(body, "instruction"), "");
        if (instruction.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_INSTRUCTION_REQUIRED", "请描述想怎么改这一镜");
        }
        StringBuilder castSb = new StringBuilder();
        if (body != null && body.get("cast") != null && body.get("cast").isArray()) {
            for (JsonNode c : body.get("cast")) {
                String n = c.isObject() ? c.path("name").asText("") : c.asText("");
                if (!n.isBlank()) {
                    if (castSb.length() > 0) castSb.append("、");
                    castSb.append(n);
                }
            }
        }
        JsonNode lineIn = body == null ? null : body.get("line");
        String lineStr = lineIn != null && lineIn.isObject() && !lineIn.path("text").asText("").isBlank()
                ? lineIn.path("who").asText("旁白") + "：" + lineIn.path("text").asText("")
                : "（无）";
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("visual", visual);
        vars.put("size", orDefault(text(body, "size"), ""));
        vars.put("move", orDefault(text(body, "move"), ""));
        vars.put("line", lineStr);
        vars.put("castClause", castSb.length() > 0 ? "出场人物：" + castSb + "。" : "");
        vars.put("instruction", instruction);
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_SHOT_REWRITE, vars, 0.8);

        return withCharge(userId,
                configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_SHOT_REWRITE, 2),
                "就地改写本镜", () -> {
            JsonNode root = callJson(pc);
            String desc = text(root, "desc");
            if (desc == null || desc.isBlank()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "改写返回的内容无法解析，请重试。");
            }
            ObjectNode out = om.createObjectNode();
            out.put("desc", desc);
            out.put("size", orDefault(text(root, "size"), orDefault(text(body, "size"), "中景")));
            out.put("move", orDefault(text(root, "move"), orDefault(text(body, "move"), "固定")));
            JsonNode l = root.get("line");
            if (l != null && l.isObject() && !l.path("text").asText("").isBlank()) {
                ObjectNode ln = om.createObjectNode();
                ln.put("who", l.path("who").asText("旁白"));
                ln.put("text", l.path("text").asText(""));
                out.set("line", ln);
            } else {
                out.putNull("line");
            }
            log.info("[drama-project] shot rewrite ok user={} id={}", userId, id);
            return out;
        });
    }

    /** ff/lf_chars 校验：只保留「已知人物名」，去重，过滤模型编造的名字（不抛错，避免硬失败）。 */
    private ArrayNode filterKnownNames(JsonNode names, java.util.Set<String> known) {
        ArrayNode arr = om.createArrayNode();
        if (names != null && names.isArray()) {
            java.util.LinkedHashSet<String> seen = new java.util.LinkedHashSet<>();
            for (JsonNode n : names) {
                String s = n.asText("");
                if (!s.isBlank() && known.contains(s) && seen.add(s)) arr.add(s);
            }
        }
        return arr;
    }

    /** 从大纲重抽角色阵容。→ { characters: CharacterDef[] }（未落库）。 */
    public JsonNode castAiDraft(String id, String userId) {
        DramaProject row = requireOwned(id, userId);
        requireLlm();
        JsonNode data = readPayload(row);
        String logline = data.path("projectInfo").path("logline").asText("");
        StringBuilder eps = new StringBuilder();
        int n = 0;
        for (JsonNode e : data.path("episodes")) {
            if (n++ >= 6) break;
            eps.append("第").append(e.path("no").asInt()).append("集：").append(orDefault(text(e, "content"), e.path("synopsis").asText(""))).append("\n");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("title", orDefault(row.getTitle(), "未命名"));
        vars.put("loglineClause", logline.isBlank() ? "" : "一句话剧情：" + logline + "。");
        vars.put("epsClause", eps.length() == 0 ? "" : "分集梗概：\n" + eps);
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_CAST, vars, 0.9);

        return withCharge(userId,
                configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_CAST, 5),
                "从大纲重抽角色 AI", () -> {
        JsonNode root = callJson(pc);
        JsonNode charsIn = root.path("characters");
        if (!charsIn.isArray() || charsIn.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "角色生成返回的内容无法解析，请重试。");
        }
        ArrayNode chars = om.createArrayNode();
        int i = 1;
        for (JsonNode c : charsIn) {
            if (!c.isObject()) continue;
            ObjectNode ch = om.createObjectNode();
            ch.put("id", "ch_" + i);
            ch.put("name", orDefault(text(c, "name"), "角色 " + i));
            String role = orDefault(text(c, "role"), "extra");
            ch.put("role", role.equals("key") ? "key" : "extra");
            ch.put("cast", orDefault(text(c, "cast"), ""));
            ch.put("desc", orDefault(text(c, "desc"), ""));
            ch.put("avatar", "a" + (((i - 1) % 8) + 1));
            ch.put("bound", false);
            chars.add(ch);
            i++;
        }
        log.info("[drama-project] cast ai-draft ok user={} id={} got={}", userId, id, chars.size());
        ObjectNode out = om.createObjectNode();
        out.set("characters", chars);
        return out;
        });
    }

    // ── 互动剧 AI 起草整张分支图（v0.79，互动剧 = 项目形态，不是独立实体） ──────────────

    /**
     * 一句话主题 → 大纲分集（图节点）+ 分支叠加层（起始集 / 全局标记 / 按集互动点 + 接线）。
     * 不落库，返回 { episodes: EpisodeOutline[], interactive: {startEpisodeId, globalFlags, nodes} }，
     * 前端合并入 ProjectData 后整图保存（与 {@link #outlineAiDraft} 同惯例）。每一集仍走六阶段制作出片。
     */
    public JsonNode interactiveDraft(String id, JsonNode body, String userId) {
        DramaProject row = requireOwned(id, userId);
        requireLlm();
        JsonNode info = readPayload(row).path("projectInfo");
        String theme = orDefault(text(body, "theme"),
                orDefault(text(info, "title"), orDefault(row.getTitle(), ""))).trim();
        if (theme.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_THEME_REQUIRED", "请先填写一句话主题再起草互动剧");
        }
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("theme", theme);
        PromptCall pc = preparePrompt(PromptService.KEY_DRAMA_INTERACTIVE_DRAFT, vars, 0.9);

        long price = configs.getLong(com.aistareco.aep.config.DramaConfigSeeder.KEY_INTERACTIVE_DRAFT, 18);
        return withCharge(userId, price, "互动剧 AI 起草分支图", () -> {
            ObjectNode out = buildInteractiveDraft(callJson(pc));
            if (out.path("episodes").size() == 0) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT",
                        "互动剧起草返回的内容无法解析，请重试或换个说法。");
            }
            log.info("[drama-project] interactive ai-draft ok user={} id={} episodes={}",
                    userId, id, out.path("episodes").size());
            return out;
        });
    }

    /** 把大模型返回的互动剧图（no 基）归一化为 { episodes（大纲）, interactive（startEpisodeId/globalFlags/nodes） }。 */
    private ObjectNode buildInteractiveDraft(JsonNode root) {
        ArrayNode episodes = om.createArrayNode();
        ObjectNode nodes = om.createObjectNode();
        ObjectNode flags = om.createObjectNode();
        JsonNode flagsIn = root.path("globalFlags");
        if (flagsIn.isObject()) flagsIn.fields().forEachRemaining(f -> flags.set(safeFlagName(f.getKey()), f.getValue()));

        List<JsonNode> list = new ArrayList<>();
        for (JsonNode e : root.path("episodes")) if (e.isObject()) list.add(e);
        // 先分配稳定集号（缺省 / 冲突时顺延），再建大纲 + overlay 节点。
        java.util.Set<Integer> nos = new java.util.LinkedHashSet<>();
        int[] noByIdx = new int[list.size()];
        int auto = 1;
        for (int i = 0; i < list.size(); i++) {
            int no = list.get(i).path("no").asInt(0);
            if (no <= 0 || nos.contains(no)) { while (nos.contains(auto)) auto++; no = auto; }
            nos.add(no);
            noByIdx[i] = no;
        }
        for (int i = 0; i < list.size(); i++) {
            JsonNode e = list.get(i);
            int no = noByIdx[i];
            String eid = "ep" + no;
            ObjectNode outline = om.createObjectNode();
            outline.put("no", no);
            outline.put("title", orDefault(text(e, "title"), orDefault(text(e, "hook"), "第 " + no + " 集")));
            outline.put("content", orDefault(text(e, "content"), orDefault(text(e, "synopsis"), orDefault(text(e, "summary"), ""))));
            episodes.add(outline);

            ObjectNode node = om.createObjectNode();
            boolean isEnding = e.path("isEnding").asBoolean(false);
            node.set("interactions", normalizeInteractions(e.path("interactions"), eid));
            int nextNo = e.path("nextEp").asInt(0);
            if (!isEnding && nextNo > 0 && nos.contains(nextNo)) node.put("nextVideoId", "ep" + nextNo);
            else node.putNull("nextVideoId");
            node.put("isEnding", isEnding);
            if (isEnding) node.put("endingLabel", orDefault(text(e, "endingLabel"), "结局"));
            nodes.set(eid, node);
        }

        int startNo = root.path("startEp").asInt(0);
        String startId = (startNo > 0 && nos.contains(startNo)) ? "ep" + startNo
                : (episodes.size() > 0 ? "ep" + episodes.get(0).path("no").asInt(1) : "ep1");

        ObjectNode out = om.createObjectNode();
        out.set("episodes", episodes);
        ObjectNode interactive = om.createObjectNode();
        interactive.put("enabled", true);
        interactive.put("startEpisodeId", startId);
        interactive.set("globalFlags", flags);
        interactive.set("nodes", nodes);
        out.set("interactive", interactive);
        return out;
    }

    /** 互动点归一化：稳定 id、按 triggerTime 升序、选项 nextEp(集号) → nextVideoId("ep"+集号)、setFlags 收对象。 */
    private ArrayNode normalizeInteractions(JsonNode arr, String epId) {
        ArrayNode out = om.createArrayNode();
        if (!arr.isArray()) return out;
        List<ObjectNode> points = new ArrayList<>();
        int i = 1;
        for (JsonNode it : arr) {
            if (!it.isObject()) continue;
            ObjectNode point = om.createObjectNode();
            point.put("id", epId + "_i" + i);
            point.put("triggerTime", Math.max(0, it.path("triggerTime").asInt(0)));
            String type = orDefault(text(it, "interactionType"), "choice");
            if (!type.equals("choice") && !type.equals("input") && !type.equals("countdown")) type = "choice";
            point.put("interactionType", type);
            String condition = text(it, "condition");
            if (condition != null && !condition.isBlank()) point.put("condition", condition);

            ObjectNode ui = om.createObjectNode();
            JsonNode uiIn = it.path("uiConfig");
            ui.put("question", orDefault(text(uiIn, "question"), orDefault(text(it, "question"), "你的选择？")));
            int cd = uiIn.path("countdownSec").asInt(it.path("countdownSec").asInt(0));
            if (cd > 0) ui.put("countdownSec", clamp(cd, 1, 60));
            String inputKey = text(uiIn, "inputKey");
            if (inputKey != null && !inputKey.isBlank()) ui.put("inputKey", safeFlagName(inputKey));

            ArrayNode optsOut = om.createArrayNode();
            JsonNode optsIn = uiIn.path("options");
            int oi = 0;
            if (optsIn.isArray()) {
                for (JsonNode o : optsIn) {
                    if (!o.isObject()) continue;
                    ObjectNode opt = om.createObjectNode();
                    opt.put("id", orDefault(text(o, "id"), oi < 26 ? String.valueOf((char) ('A' + oi)) : "O" + oi));
                    opt.put("text", orDefault(text(o, "text"), "选项 " + (oi + 1)));
                    int ne = o.path("nextEp").asInt(0);
                    if (ne > 0) opt.put("nextVideoId", "ep" + ne); else opt.putNull("nextVideoId");
                    JsonNode setFlags = o.path("setFlags");
                    if (setFlags.isObject() && setFlags.size() > 0) {
                        ObjectNode sf = om.createObjectNode();
                        setFlags.fields().forEachRemaining(f -> sf.set(safeFlagName(f.getKey()), f.getValue()));
                        opt.set("setFlags", sf);
                    }
                    optsOut.add(opt);
                    oi++;
                }
            }
            ui.set("options", optsOut);
            point.set("uiConfig", ui);
            points.add(point);
            i++;
        }
        points.sort((a, b) -> Integer.compare(a.path("triggerTime").asInt(0), b.path("triggerTime").asInt(0)));
        points.forEach(out::add);
        return out;
    }

    /** flag 名只留字母数字下划线（与 condition 表达式里 globalFlags.X 取词一致）。 */
    private static String safeFlagName(String raw) {
        String s = raw == null ? "" : raw.trim().replaceAll("[^A-Za-z0-9_]", "");
        return s.isBlank() ? "flag" : s;
    }

    /** BoardShot 归一化（id/no/默认值）。 */
    private ObjectNode normalizeShot(JsonNode sh, String sceneId, int no) {
        ObjectNode shot = om.createObjectNode();
        shot.put("id", sceneId + "_s" + no);
        shot.put("no", no);
        shot.put("size", orDefault(text(sh, "size"), "中景"));
        shot.put("move", orDefault(text(sh, "move"), "固定"));
        // v0.97 P1：机位标识（同机位复用同值，跨镜保持取景一致；AI 给则用，缺省空，前端可编辑落库）。
        shot.put("camId", orDefault(text(sh, "camId"), ""));
        int dur = sh.path("dur").asInt(sh.path("duration_sec").asInt(4));
        shot.put("dur", Math.max(1, Math.min(30, dur)));
        String engine = orDefault(text(sh, "engine"), "seedance");
        shot.put("engine", engine.equals("avatar") ? "avatar" : "seedance");
        shot.put("desc", orDefault(text(sh, "desc"), ""));
        shot.set("cast", om.createArrayNode());
        // v0.88 设计稿分镜表三件套：音效 / BGM / 特效氛围（AI 给则用，缺省空，前端可编辑落库）。
        shot.put("sfx", orDefault(text(sh, "sfx"), ""));
        shot.put("bgm", orDefault(text(sh, "bgm"), ""));
        shot.put("fx", orDefault(text(sh, "fx"), ""));
        JsonNode line = sh.get("line");
        if (line != null && line.isObject() && !line.path("text").asText("").isBlank()) {
            ObjectNode l = om.createObjectNode();
            l.put("who", line.path("who").asText("旁白"));
            l.put("text", line.path("text").asText(""));
            shot.set("line", l);
        } else {
            shot.putNull("line");
        }
        return shot;
    }

    private void requireLlm() {
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "AI 生成还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
    }

    /** 一次解析好的 prompt 调用包（system/user 已填充，参数已定）。 */
    private record PromptCall(String system, String user, double temperature, int maxTokens, boolean jsonMode) {}

    /**
     * 解析 prompt（DB→resource→code 兜底）+ 填充占位符 + 选定参数。
     * origin=code（DB 与 resource 都没有该 key）视为「prompt 未配置」→ 抛错不扣费（§8.0）。
     * temperature/maxTokens 取运营在 admin 设的值；为空时回落到本动作的推荐默认。
     */
    private PromptCall preparePrompt(String promptKey, Map<String, String> vars, double defaultTemp) {
        PromptService.ResolvedPrompt p = promptService.resolve(promptKey);
        if ("code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "该短剧 AI 动作的提示词尚未配置（promptKey=" + promptKey
                            + "）。请在管理后台「短剧专区 · 提示词设置」补全后再试。");
        }
        double temperature = p.params().temperature() != null ? p.params().temperature() : defaultTemp;
        int maxTokens = p.params().maxTokens() != null && p.params().maxTokens() > 0 ? p.params().maxTokens() : 4096;
        boolean jsonMode = p.params().jsonMode() == null || p.params().jsonMode();
        // 排查用：拼装后的结构化数据（vars）+ 提示词来源。最终发给模型的全文见 aep.ai.chat.io。
        log.info("[drama-ai] promptKey={} origin={} vars={}", promptKey, p.origin(), vars);
        return new PromptCall(p.system(), PromptService.fill(p.userTemplate(), vars), temperature, maxTokens, jsonMode);
    }

    /** 低层 chat 调用（统一错误码）。 */
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
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED", "AI 生成调用失败，请稍后重试。");
        }
    }

    /** chat 调用 + JSON 容错解析。 */
    private JsonNode callJson(PromptCall pc) {
        JsonNode root = tryReadJson(invoke(pc).content());
        if (root == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "AI_BAD_OUTPUT", "AI 返回的内容无法解析，请重试。");
        }
        return root;
    }

    // ── 内部工具 ────────────────────────────────────────────────────────────────

    private DramaProject requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_PROJECT_NOT_FOUND", "短剧项目不存在"));
    }

    /** 新建时的空 ProjectData（结构合法、各数组为空，前端各阶段渲染空状态）。 */
    private ObjectNode seedProjectData(String title, String type, int episodes, String ratio,
                                       String logline, String mainline, boolean interactive) {
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
        // v0.88：项目级场景设定（短剧设定页「角色与场景」）+ 大纲分集 AI 参数（持久化）。
        root.set("scenes", om.createArrayNode());
        ObjectNode outlinePrefs = om.createObjectNode();
        outlinePrefs.put("scope", "trial");
        outlinePrefs.put("dur", ratio.startsWith("16") ? "60 秒/集" : "75 秒/集");
        root.set("outlinePrefs", outlinePrefs);
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
        // v0.66：按集存档（剧本/分镜/成片），切集互不覆盖
        root.set("episodeDocs", om.createObjectNode());
        // v0.79：互动剧形态 —— 叠加分支编排层（起始集 / 全局标记 / 按集互动点 + 接线），
        // 剧集（图节点）即上面的 episodes，每集视频复用六阶段成片。空图，由 AI 起草 / 手动加集填充。
        if (interactive) {
            ObjectNode ov = om.createObjectNode();
            ov.put("enabled", true);
            ov.put("startEpisodeId", "ep1");
            ov.set("globalFlags", om.createObjectNode());
            ov.set("nodes", om.createObjectNode());
            root.set("interactive", ov);
        }
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
            ep.put("title", orDefault(text(e, "title"), orDefault(text(e, "hook"), "第 " + no + " 集")));
            ep.put("content", orDefault(text(e, "content"), orDefault(text(e, "synopsis"), orDefault(text(e, "summary"), ""))));
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

    /** 回收站卡片：在 summary 基础上加 deletedAt / purgeAt / daysLeft（剩余天数，向上取整）。 */
    private ObjectNode toTrashItem(DramaProject p) {
        ObjectNode s = toSummary(p);
        OffsetDateTime del = p.getDeletedAt();
        OffsetDateTime purge = del != null ? del.plusDays(TRASH_RETENTION_DAYS) : null;
        long daysLeft = TRASH_RETENTION_DAYS;
        if (purge != null) {
            long ms = Duration.between(OffsetDateTime.now(), purge).toMillis();
            daysLeft = Math.max(0, (ms + 86_399_999L) / 86_400_000L);
        }
        s.put("deletedAt", del != null ? del.toString() : null);
        s.put("purgeAt", purge != null ? purge.toString() : null);
        s.put("daysLeft", daysLeft);
        return s;
    }

    private ObjectNode toDetail(DramaProject p) {
        ObjectNode out = om.createObjectNode();
        out.set("meta", toSummary(p));
        JsonNode data = readPayload(p);
        // §4.7：payloadJson 里存的是「当时签名的 OSS URL」，签名有 TTL 会过期 → 图裂。
        // 出 wire 时对文档内所有资产 URL 重签（maybeSign 从 URL 抽 key 重签，对已过期 URL 同样有效）。
        // driver=local 的相对 /cdn 路径不匹配 OSS base → 原样返回，dev 不受影响。
        resignAssetUrls(data);
        // C-2：把角色/场景实体表的多角度参考图集（cdnKey → 派生 url）叠加进文档，让前端看到三视图产物。
        assets.overlayEntityRefs(p.getId(), data);
        out.set("data", data);
        return out;
    }

    /** 递归重签文档内所有 OSS 资产 URL（首帧/末帧/成片/场景图/角色图…），避免存下的签名 URL 过期后 403 图裂。 */
    private void resignAssetUrls(JsonNode node) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            java.util.List<String> keys = new java.util.ArrayList<>();
            o.fieldNames().forEachRemaining(keys::add);
            for (String k : keys) {
                JsonNode v = o.get(k);
                if (v != null && v.isTextual()) {
                    String signed = signer.maybeSign(v.asText());
                    if (signed != null && !signed.equals(v.asText())) o.put(k, signed);
                } else {
                    resignAssetUrls(v);
                }
            }
        } else if (node.isArray()) {
            ArrayNode a = (ArrayNode) node;
            for (int i = 0; i < a.size(); i++) {
                JsonNode v = a.get(i);
                if (v != null && v.isTextual()) {
                    String signed = signer.maybeSign(v.asText());
                    if (signed != null && !signed.equals(v.asText())) a.set(i, com.fasterxml.jackson.databind.node.TextNode.valueOf(signed));
                } else {
                    resignAssetUrls(v);
                }
            }
        }
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
