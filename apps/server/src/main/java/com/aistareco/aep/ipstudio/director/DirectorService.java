package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.IpLibraryDtos;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioMediaImportService;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioReferenceInput;
import com.aistareco.aep.ipstudio.service.StudioVideoService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowWorker;
import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import com.aistareco.aep.ipstudio.h3.H3PromptRewrite;
import java.util.*;

/**
 * AI 导演台（docs/ai-director-plan.md v1.1）：作品、三个工作区的编辑、生成任务与一键连跑。
 *
 * <p>作品内容由服务端拥有（§10.3）：
 * <ul>
 *   <li>用户编辑带对象修订号 {@code rev}，对不上返回 409，不以后到覆盖先到；</li>
 *   <li>生成结果回投前比对提交时的输入指纹：输入没变才填空着的采用位（标 {@code adoptedBy=auto}，需要用户确认），
 *       变了就只追加为「按旧设置生成」的历史版本；已有正文、计划、提示词和已采用版本一律不动；</li>
 *   <li>任务就是原生的 {@link IpRun}（宿主类型 director，{@code projectId} 存作品 id，{@code nodeId} 存目标），
 *       计价、冻结、付款、结算、幂等都在原链路上，这里不记第二份账。</li>
 * </ul>
 */
@Service
public class DirectorService {
    private static final Logger log = LoggerFactory.getLogger(DirectorService.class);

    /** 一个连跑同时最多在途的子任务（§8.4 初始建议：同一端点 2 个）。 */
    static final int PIPELINE_INFLIGHT = 2;
    private static final int MAX_WORKS = 200;
    private static final int SHOT_TEXT_MAX = 1000;
    /** 片段视频需要「全能参考」模式：分镜板和资产参考图一起交给视频模型。 */
    private static final String VIDEO_MODE = JusuanH3Contract.MODE_UNIVERSAL_REFERENCE;

    private final DirectorWorkRepository works;
    private final IpRunRepository runs;
    private final IpProjectService projects;
    private final IpRunService imageRuns;
    private final StudioWorkflowService textRuns;
    private final StudioWorkflowWorker workflowWorker;
    private final StudioVideoService videoModels;
    private final StudioFixtureProvider fixtures;
    private final StudioMediaImportService mediaImport;
    private final MaterialVideoJobService videoJobs;
    private final com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoClient;
    private final com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies;
    private final com.aistareco.aep.service.storage.FileStorageService storage;
    private final com.aistareco.aep.ipstudio.config.IpStudioProperties studioProps;
    private final com.aistareco.aep.ipstudio.service.IpLibraryService library;
    private final ObjectMapper om;
    private final TransactionTemplate newTx;

    public DirectorService(DirectorWorkRepository works, IpRunRepository runs, IpProjectService projects, IpRunService imageRuns,
                           StudioWorkflowService textRuns, StudioWorkflowWorker workflowWorker, StudioVideoService videoModels,
                           StudioFixtureProvider fixtures, StudioMediaImportService mediaImport, MaterialVideoJobService videoJobs,
                           com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoClient,
                           com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies,
                           com.aistareco.aep.service.storage.FileStorageService storage,
                           com.aistareco.aep.ipstudio.config.IpStudioProperties studioProps,
                           com.aistareco.aep.ipstudio.service.IpLibraryService library,
                           ObjectMapper om, PlatformTransactionManager txManager) {
        this.works = works; this.runs = runs; this.projects = projects; this.imageRuns = imageRuns; this.textRuns = textRuns;
        this.workflowWorker = workflowWorker; this.videoModels = videoModels; this.fixtures = fixtures;
        this.mediaImport = mediaImport; this.videoJobs = videoJobs; this.videoClient = videoClient; this.scenePolicies = scenePolicies;
        this.storage = storage; this.studioProps = studioProps; this.library = library; this.om = om;
        this.newTx = new TransactionTemplate(txManager);
        this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    // ── 作品 ────────────────────────────────────────────────────────────────

    public record CreateRequest(String title, String idea, String script) {}

    @Transactional
    public JsonNode create(String userId, CreateRequest req) {
        if (works.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).size() >= MAX_WORKS)
            throw BusinessException.badRequest("DIRECTOR_WORK_LIMIT", "作品数量已达上限，请先删除不需要的作品");
        String idea = req == null || req.idea() == null ? "" : req.idea().trim();
        String script = req == null || req.script() == null ? "" : req.script().trim();
        if (idea.length() > 2000) throw invalid("创意不超过 2000 字");
        if (script.length() > 60000) throw invalid("剧本过长，请拆分为多部作品导入");
        String title = req == null || req.title() == null ? "" : req.title().trim();
        if (title.length() > 60) throw invalid("作品名不超过 60 字");
        if (title.isEmpty()) title = idea.isEmpty() ? (script.isEmpty() ? "未命名作品" : firstLine(script)) : shortTitle(idea);
        ObjectNode c = om.createObjectNode();
        c.put("idea", idea).put("logline", "").put("draft", script).put("draftRev", 0).put("seq", 0);
        c.putObject("settings").put("style", "真人写实").put("aspectRatio", "9:16").put("language", "中文").putNull("videoModel").putNull("imageModel").putNull("textModel");
        c.putArray("episodes"); c.putArray("assets"); c.putArray("clips"); c.putArray("applied");
        c.putObject("taskMeta"); c.putNull("pipeline"); c.putNull("notice"); c.putNull("textError");
        DirectorWork w = new DirectorWork();
        w.setId("DW-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
        w.setOwnerUserId(userId); w.setTitle(title); w.setRevision(1);
        w.setCreatedAt(Instant.now()); w.setUpdatedAt(Instant.now());
        w.setContentJson(write(c));
        works.save(w);
        return view(userId, w, c);
    }

    @Transactional(readOnly = true)
    public List<JsonNode> list(String userId) {
        List<DirectorWork> mine = works.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId);
        List<JsonNode> out = new ArrayList<>();
        Map<String, String> coverKeys = new LinkedHashMap<>();
        for (DirectorWork w : mine) {
            JsonNode c = read(w);
            int boards = 0, videos = 0;
            String cover = null;
            for (JsonNode clip : c.path("clips")) {
                String b = adoptedKey(clip.path("board"));
                if (b != null) { boards++; if (cover == null) cover = b; }
                if (adoptedKey(clip.path("video")) != null) videos++;
            }
            if (cover == null) for (JsonNode a : c.path("assets")) { cover = adoptedKey(a.path("image")); if (cover != null) break; }
            if (cover != null) coverKeys.put(w.getId(), cover);
            ObjectNode s = om.createObjectNode().put("id", w.getId()).put("title", w.getTitle())
                    .put("episodeCount", c.path("episodes").size()).put("assetCount", c.path("assets").size())
                    .put("clipCount", c.path("clips").size()).put("boardCount", boards).put("videoCount", videos)
                    .put("hasScript", !c.path("draft").asText().isBlank() || c.path("episodes").size() > 0)
                    .put("running", w.isActive()).put("updatedAt", w.getUpdatedAt().toString()).putNull("coverUrl");
            out.add(s);
        }
        Map<String, String> signed = sign(userId, new ArrayList<>(coverKeys.values()));
        for (JsonNode s : out) {
            String key = coverKeys.get(s.path("id").asText());
            if (key != null && signed.get(key) != null) ((ObjectNode) s).put("coverUrl", signed.get(key));
        }
        return out;
    }

    /** 读作品：先把已完成的任务结果回投，再出 wire。 */
    @Transactional
    public JsonNode get(String userId, String id) {
        DirectorWork w = locked(userId, id);
        ObjectNode c = read(w);
        if (reconcile(w, c)) save(w, c);
        else refresh(c); // 派生字段（提示词、片段问题、声音提示）按当前资产与视频模型重算后再出 wire
        return view(userId, w, c);
    }

    /** Validate ownership in a separate transaction; read the committed stop result in a fresh snapshot. */
    public JsonNode stopTask(String userId,String id,String runId) {
        newTx.executeWithoutResult(tx->{
            locked(userId,id);
            var run=runs.findById(runId).orElseThrow(()->BusinessException.notFound("IP_RUN_NOT_FOUND","任务不存在"));
            if(!id.equals(run.getProjectId())||!userId.equals(run.getOwnerUserId()))
                throw BusinessException.notFound("IP_RUN_NOT_FOUND","任务不存在");
            if(!"studio-director".equals(run.getKind()))
                throw invalid("这项任务不能在这里停止");
        });
        workflowWorker.stopDirectorTask(runId);
        return newTx.execute(tx->get(userId,id));
    }

    public record PatchRequest(String title, String idea, String draft, Long draftRev, JsonNode settings) {}

    @Transactional
    public JsonNode patch(String userId, String id, PatchRequest req) {
        DirectorWork w = locked(userId, id);
        ObjectNode c = read(w);
        reconcile(w, c);
        if (req.title() != null) {
            String t = req.title().trim();
            if (t.isEmpty() || t.length() > 60) throw invalid("作品名为 1–60 字");
            w.setTitle(t);
        }
        if (req.idea() != null) {
            if (req.idea().length() > 2000) throw invalid("创意不超过 2000 字");
            c.put("idea", req.idea().trim());
        }
        if (req.draft() != null) {
            if (req.draftRev() == null || req.draftRev() != c.path("draftRev").asLong()) throw conflict("剧本已在其他页面修改");
            if (c.path("episodes").size() > 0) throw invalid("已拆分集，请在各集中修改正文");
            if (req.draft().length() > 60000) throw invalid("剧本过长，请拆分为多部作品导入");
            if (!req.draft().equals(c.path("draft").asText())) c.putNull("pendingSplit");
            c.put("draft", req.draft()).put("draftRev", c.path("draftRev").asLong() + 1);
        }
        if (req.settings() != null && req.settings().isObject()) {
            ObjectNode s = (ObjectNode) c.path("settings");
            JsonNode in = req.settings();
            if (in.hasNonNull("style")) {
                String style = in.path("style").asText().trim();
                if (style.isEmpty() || style.length() > 30) throw invalid("风格为 1–30 字");
                s.put("style", style);
            }
            if (in.hasNonNull("aspectRatio")) {
                String aspect = in.path("aspectRatio").asText();
                if (!List.of("9:16", "16:9", "1:1").contains(aspect)) throw invalid("画幅仅支持 9:16、16:9、1:1");
                s.put("aspectRatio", aspect);
            }
            if (in.has("imageModel")) {
                String model = in.path("imageModel").asText(null);
                // 原值照存：旧客户端每次保存都会带上它，改别的设置不该因此失败。照存不等于重新授权，
                // 生成时照常按 imageSelection 解析，停用了照样报错。
                if (model != null && !model.equals(s.path("imageModel").asText(null))) requireSelectableImageModel(model);
                if (model == null) s.putNull("imageModel"); else s.put("imageModel", model);
            }
            if (in.has("textModel")) {
                String model = in.path("textModel").asText(null);
                // 同图片模型：原值照存，换了才校验（与展示、估价和提交同一份后台候选）。
                if (model != null && !model.equals(s.path("textModel").asText(null))) textRuns.directorPrices(model);
                if (model == null) s.putNull("textModel"); else s.put("textModel", model);
            }
            if (in.has("videoModel")) {
                String model = in.path("videoModel").asText(null);
                if (model != null && videoChoices().stream().noneMatch(v -> v.id().equals(model)))
                    throw invalid("该视频模型不支持片段生成，请选择其他模型");
                if (model == null) s.putNull("videoModel"); else s.put("videoModel", model);
            }
        }
        refresh(c);
        save(w, c);
        return view(userId, w, c);
    }

    @Transactional
    public void delete(String userId, String id) {
        DirectorWork w = locked(userId, id);
        w.setDeletedAt(Instant.now()); w.setActive(false);
        works.save(w);
    }

    // ── 编辑（用户的修改，带对象修订号）──────────────────────────────────────

    public record EditRequest(String op, String targetId, Long rev, JsonNode data) {}

    @Transactional
    public JsonNode edit(String userId, String id, EditRequest req) {
        DirectorWork w = locked(userId, id);
        ObjectNode c = read(w);
        reconcile(w, c);
        JsonNode d = req.data() == null ? om.createObjectNode() : req.data();
        switch (req.op() == null ? "" : req.op()) {
            case "draft.asEpisode" -> {
                if (c.path("episodes").size() > 0) throw invalid("已有分集");
                String draft = c.path("draft").asText();
                if (draft.isBlank()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_SCRIPT_MISSING", "请先生成或导入剧本");
                asOneEpisode(w, c);
            }
            case "split.save", "split.discard" -> {
                JsonNode pending = c.path("pendingSplit");
                if (!pending.isObject() || req.targetId() == null || !req.targetId().equals(pending.path("id").asText()))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SPLIT_EXPIRED", "这份分集结果已失效，请重新拆分");
                ObjectNode p = c.path("pipeline").isObject() ? (ObjectNode) c.path("pipeline") : null;
                boolean live = p != null && Set.of("running", "waiting", "paused").contains(p.path("status").asText());
                if ("split.save".equals(req.op())) {
                    int n = applySplit(c, pending, "episode".equals(d.path("preamble").asText()));
                    notice(c, "已分成 " + n + " 集");
                    if (p != null && "waiting".equals(p.path("status").asText()) && "confirm-split".equals(p.path("stage").asText())) {
                        p.put("status", "running").put("stage", "split").put("message", "分集已确认，继续制作"); w.setActive(true);
                    }
                } else {
                    c.putNull("pendingSplit");
                    // 一键制作可能还没推进到「待确认」：不停下它会再提交一次付费拆分。
                    if (live) finish(p, "stopped", "分集结果未采用，一键制作已停止");
                }
            }
            case "split.undo" -> {
                JsonNode undo = c.path("splitUndo");
                if (c.path("episodes").isEmpty() || !undo.isObject()) throw invalid("这次拆分不能撤销");
                for (JsonNode clip : c.path("clips")) if (hasMedia(clip))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_CLIPS_HAVE_MEDIA", "已有分镜图或视频的片段，不能撤销拆分。请先删除这些片段");
                if (w.isActive()) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "有任务正在进行，完成后再撤销拆分");
                c.put("draft", undo.path("draft").asText()).put("draftRev", c.path("draftRev").asLong() + 1);
                c.put("reference", undo.path("reference").asText()).put("referenceRev", c.path("referenceRev").asLong() + 1);
                c.putArray("episodes"); c.putArray("clips"); c.putNull("pendingExtract"); c.putNull("splitUndo");
                for (JsonNode a : c.path("assets")) ((ObjectNode) a).putArray("episodeIds");
                ObjectNode p = c.path("pipeline").isObject() ? (ObjectNode) c.path("pipeline") : null;
                if (p != null && Set.of("waiting", "paused").contains(p.path("status").asText())) finish(p, "stopped", "已撤销拆分，一键制作已停止");
                notice(c, "已撤销拆分，剧本恢复到拆分前；资产保留，重新拆分后可再提取");
            }
            case "reference.update" -> {
                if (req.rev() == null || req.rev() != c.path("referenceRev").asLong()) throw conflict("设定资料已在其他页面修改");
                c.put("reference", limited(d.path("text").asText(), 60000, "设定资料")).put("referenceRev", c.path("referenceRev").asLong() + 1);
            }
            case "reference.toEpisode" -> {
                if (req.rev() == null || req.rev() != c.path("referenceRev").asLong()) throw conflict("设定资料已在其他页面修改");
                String ref = c.path("reference").asText();
                if (ref.isBlank() || c.path("episodes").isEmpty()) throw invalid("没有可以并入的设定资料");
                ObjectNode first = (ObjectNode) c.path("episodes").get(0);
                first.put("content", limited(ref + "\n\n" + first.path("content").asText(), 60000, "第 1 集正文"));
                if (hasClips(c, first.path("id").asText())) first.put("planStale", true);
                bump(first);
                c.put("reference", "").put("referenceRev", c.path("referenceRev").asLong() + 1);
                notice(c, "设定资料已并入第 1 集开头");
            }
            case "episode.update" -> {
                ObjectNode ep = requireRev(find(c, "episodes", req.targetId(), "这一集"), req.rev());
                if (d.has("title")) ep.put("title", limited(d.path("title").asText(), 60, "集名"));
                if (d.has("summary")) ep.put("summary", limited(d.path("summary").asText(), 1000, "摘要"));
                if (d.has("content") && !d.path("content").asText().equals(ep.path("content").asText())) {
                    ep.put("content", limited(d.path("content").asText(), 60000, "正文"));
                    if (hasClips(c, ep.path("id").asText())) ep.put("planStale", true);
                }
                bump(ep);
            }
            case "episode.usePendingPlan" -> {
                ObjectNode ep = find(c, "episodes", req.targetId(), "这一集");
                JsonNode pending = ep.path("pendingPlan");
                if (!pending.isObject()) throw invalid("没有待替换的新计划");
                replaceClips(c, ep, pending.path("clips"));
                ep.putNull("pendingPlan");
            }
            case "episode.discardPendingPlan" -> find(c, "episodes", req.targetId(), "这一集").putNull("pendingPlan");
            case "asset.create" -> {
                String kind = d.path("kind").asText();
                if (!Set.of("character", "scene", "prop").contains(kind)) throw invalid("请选择角色、场景或道具");
                String name = limited(d.path("name").asText(), 40, "名称");
                if (name.isEmpty()) throw invalid("请填写名称");
                ObjectNode a = newAsset(c, kind, name, limited(d.path("description").asText(), 2000, "描述"));
                if (d.has("episodeIds")) a.set("episodeIds", episodeIds(c, d.path("episodeIds")));
                ((ArrayNode) c.path("assets")).add(a);
            }
            case "asset.update" -> {
                ObjectNode a = requireRev(find(c, "assets", req.targetId(), "这个资产"), req.rev());
                if (d.has("name")) { String n = limited(d.path("name").asText(), 40, "名称"); if (!n.isEmpty()) a.put("name", n); }
                if (d.has("description")) a.put("description", limited(d.path("description").asText(), 2000, "描述"));
                // 角色音色的文字描述：没有参考音频时视频按它配音，有参考音频时作补充。
                if (d.has("voiceDesc")) a.put("voiceDesc", limited(d.path("voiceDesc").asText(), 200, "音色描述"));
                if (d.has("episodeIds")) a.set("episodeIds", episodeIds(c, d.path("episodeIds")));
                if (d.path("resetPrompt").asBoolean(false)) a.put("promptCustom", false);
                else if (d.has("prompt")) a.put("prompt", limited(d.path("prompt").asText(), 4000, "提示词")).put("promptCustom", true);
                bump(a);
            }
            case "asset.delete" -> {
                find(c, "assets", req.targetId(), "这个资产");
                for (JsonNode clip : c.path("clips")) if (contains(clip.path("assetIds"), req.targetId()))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_ASSET_IN_USE", "该资产仍被片段使用，请先取消关联");
                remove(c, "assets", req.targetId());
            }
            case "asset.adopt" -> {
                adopt(find(c, "assets", req.targetId(), "这个资产"), "image", d.path("candidateId").asText());
            }
            case "asset.upload" -> {
                // 角色、场景、道具都一样：上传的图直接作为参考图（2026-10-26 用户改判，此前角色只能生成设定图）。
                ObjectNode a = find(c, "assets", req.targetId(), "这个资产");
                String key = projects.requireOwnedAssetKey(userId, d.path("key").asText(null));
                if (key == null) throw invalid("请先上传图片");
                ObjectNode m = addCandidate(c, (ObjectNode) a.path("image"), key, null, "upload");
                adopt(a, "image", m.path("id").asText());
            }
            case "asset.link" -> {
                // 关联已有资产：这项资产就是个人资产库里的那一项。只收对象 id 和版本，图和描述由服务端按本人资产库读出来。
                ObjectNode target = find(c, "assets", req.targetId(), "这个资产");
                linkLibrary(userId, c, target, library.object(userId, d.path("objectId").asText()), d.path("versionId").asText(null));
            }
            case "assets.confirm" -> {
                Set<String> only = new HashSet<>();
                d.path("assetIds").forEach(x -> only.add(x.asText()));
                for (JsonNode a : c.path("assets")) {
                    ObjectNode slot = (ObjectNode) a.path("image");
                    if ("auto".equals(slot.path("adoptedBy").asText()) && (only.isEmpty() || only.contains(a.path("id").asText())))
                        slot.put("adoptedBy", "user");
                }
            }
            case "clip.update" -> {
                ObjectNode clip = requireRev(find(c, "clips", req.targetId(), "这个片段"), req.rev());
                if (d.has("title")) clip.put("title", limited(d.path("title").asText(), 40, "片段标题"));
                if (d.has("summary")) clip.put("summary", limited(d.path("summary").asText(), 1000, "片段摘要"));
                if (d.has("assetIds")) {
                    ArrayNode ids = clip.putArray("assetIds");
                    Set<String> seen = new HashSet<>();
                    d.path("assetIds").forEach(x -> { if (seen.add(x.asText())) ids.add(x.asText()); });
                }
                if (d.has("shots")) setShots(c, clip, d.path("shots"), true);
                if (d.path("resetBoardPrompt").asBoolean(false)) clip.put("boardPromptCustom", false);
                else if (d.has("boardPrompt")) clip.put("boardPrompt", limited(d.path("boardPrompt").asText(), 7000, "分镜图提示词")).put("boardPromptCustom", true);
                if (d.path("resetVideoPrompt").asBoolean(false)) clip.put("videoPromptCustom", false);
                else if (d.has("videoPrompt")) clip.put("videoPrompt", limited(d.path("videoPrompt").asText(), 7000, "视频提示词")).put("videoPromptCustom", true);
                bump(clip);
            }
            case "clip.split" -> {
                ObjectNode clip = requireRev(find(c, "clips", req.targetId(), "这个片段"), req.rev());
                if (clip.path("video").path("pending").size() > 0)
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "该片段视频生成中，完成后再拆分");
                // 已有的分镜图 / 视频留在前一段的历史里，会被标成「按旧设置生成」，需要重新生成。
                int at = d.path("atShot").asInt(-1);
                ArrayNode shots = (ArrayNode) clip.path("shots");
                if (at <= 0 || at >= shots.size()) throw invalid("请选择拆分位置");
                ArrayNode tail = om.createArrayNode();
                while (shots.size() > at) tail.add(shots.remove(at));
                setShots(c, clip, shots.deepCopy(), false);
                ObjectNode next = newClip(c, clip.path("episodeId").asText(), clip.path("title").asText() + "（续）", clip.path("summary").asText());
                next.set("assetIds", clip.path("assetIds").deepCopy());
                setShots(c, next, tail, false);
                ArrayNode clips = (ArrayNode) c.path("clips");
                int index = 0;
                for (int i = 0; i < clips.size(); i++) if (clips.get(i) == clip) index = i;
                clips.insert(index + 1, next);
                renumber(c, clip.path("episodeId").asText());
                bump(clip);
            }
            case "clip.delete" -> {
                String epId = find(c, "clips", req.targetId(), "这个片段").path("episodeId").asText();
                remove(c, "clips", req.targetId());
                renumber(c, epId);
            }
            case "clip.adoptBoard" -> adopt(find(c, "clips", req.targetId(), "这个片段"), "board", d.path("candidateId").asText());
            case "clip.confirmBoard" -> {
                ObjectNode slot = (ObjectNode) find(c, "clips", req.targetId(), "这个片段").path("board");
                if (adoptedKey(slot) == null) throw invalid("暂无分镜图");
                slot.put("adoptedBy", "user");
            }
            case "asset.setVoice" -> {
                ObjectNode a = find(c, "assets", req.targetId(), "这个资产");
                if (!"character".equals(a.path("kind").asText())) throw invalid("只有角色可以绑定声音");
                String key = projects.requireOwnedAssetKey(userId, d.path("key").asText(null));
                if (key == null) throw invalid("请上传声音或从声音库选择");
                ObjectNode v = a.putObject("voice").put("key", key).put("name", limited(d.path("name").asText("声音样本"), 60, "声音名称"))
                        .put("source", "library".equals(d.path("source").asText()) ? "library" : "upload").put("at", Instant.now().toString());
                if (d.path("durationSec").isNumber()) v.put("durationSec", d.path("durationSec").asDouble()); else v.putNull("durationSec");
                if (d.hasNonNull("voiceId")) v.put("voiceId", d.path("voiceId").asText()); else v.putNull("voiceId");
                bump(a);
            }
            case "asset.setRef" -> {
                ObjectNode a = find(c, "assets", req.targetId(), "这个资产");
                if (!"character".equals(a.path("kind").asText())) throw invalid("只有角色可以设置形象参考");
                String key = projects.requireOwnedAssetKey(userId, d.path("key").asText(null));
                if (key == null) throw invalid("请先上传图片");
                a.putObject("refImage").put("key", key);
                bump(a);
            }
            case "asset.clearRef" -> { ObjectNode a = find(c, "assets", req.targetId(), "这个资产"); a.putNull("refImage"); bump(a); }
            case "asset.clearVoice" -> { ObjectNode a = find(c, "assets", req.targetId(), "这个资产"); a.putNull("voice"); bump(a); }
            case "clip.adoptVideo" -> adopt(find(c, "clips", req.targetId(), "这个片段"), "video", d.path("candidateId").asText());
            case "clip.confirmVideo" -> {
                ObjectNode slot = (ObjectNode) find(c, "clips", req.targetId(), "这个片段").path("video");
                if (adoptedKey(slot) == null) throw invalid("暂无片段视频");
                slot.put("adoptedBy", "user");
            }
            case "clip.setVoiceMode" -> {
                ObjectNode clip = find(c, "clips", req.targetId(), "这个片段");
                clip.put("videoWithoutVoice", d.path("withoutVoice").asBoolean(false));
            }
            case "clips.confirmBoards" -> {
                for (JsonNode clip : c.path("clips")) if (req.targetId() == null || req.targetId().equals(clip.path("episodeId").asText())) {
                    ObjectNode slot = (ObjectNode) clip.path("board");
                    if ("auto".equals(slot.path("adoptedBy").asText())) slot.put("adoptedBy", "user");
                }
            }
            case "extract.save", "extract.discard" -> {
                JsonNode pending = c.path("pendingExtract");
                if (!pending.isObject()) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_EXTRACT_EXPIRED", "这份资产清单已失效，请重新提取");
                if (req.targetId() != null && !req.targetId().equals(pending.path("runId").asText()))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_EXTRACT_EXPIRED", "资产清单已更新，请查看最新一份");
                ObjectNode p = c.path("pipeline").isObject() ? (ObjectNode) c.path("pipeline") : null;
                boolean waiting = p != null && "waiting".equals(p.path("status").asText()) && "confirm-extract".equals(p.path("stage").asText());
                // 一键制作可能还没推进到「待确认」这一步（清单刚回投、下一次推进还没到）：不保存时一样要停，否则它会再提交一次付费提取。
                boolean live = p != null && Set.of("running", "waiting", "paused").contains(p.path("status").asText());
                if ("extract.save".equals(req.op())) {
                    int added = saveExtracted(c, pending, d.path("items"));
                    List<String> changed = markExtracted(c, pending.path("episodes"));
                    c.putNull("pendingExtract");
                    if (!changed.isEmpty()) notice(c, String.join("、", changed) + "在提取期间正文有修改，新增内容可能未提取，可重新提取");
                    else notice(c, added > 0 ? "资产已保存，新增 " + added + " 项" : "资产已保存");
                    if (waiting) { p.put("status", "running").put("stage", "assets").put("message", "资产已保存，继续制作"); w.setActive(true); }
                } else {
                    c.putNull("pendingExtract");
                    if (live) finish(p, "stopped", "资产清单未保存，一键制作已停止");
                }
            }
            case "notice.dismiss" -> c.putNull("notice");
            default -> throw invalid("不支持的修改");
        }
        refresh(c);
        save(w, c);
        return view(userId, w, c);
    }

    // ── 生成任务 ─────────────────────────────────────────────────────────────

    /** {@code maxCost} 是界面上报给用户的价格；服务端按它校验，价格变了返回 409 让用户重新确认。 */
    public record TaskRequest(String type, String targetId, String clientRequestId, JsonNode options,
                              BillingSelection billing, Long maxCost) {}

    @Transactional
    public JsonNode task(String userId, String id, TaskRequest req) {
        DirectorWork w = locked(userId, id);
        ObjectNode c = read(w);
        reconcile(w, c);
        if (req.clientRequestId() == null || req.clientRequestId().isBlank() || req.clientRequestId().length() > 48)
            throw invalid("请求编号无效，请刷新后重试");
        JsonNode o = req.options() == null ? om.createObjectNode() : req.options();
        if ("script".equals(req.type()) && o.hasNonNull("idea")) {
            if (o.path("idea").asText().length() > 2000) throw invalid("创意不超过 2000 字");
            c.put("idea", o.path("idea").asText().trim());
        }
        // 题材 / 调性：只认提示词里有追加规则的那几个，空串表示不限。
        if ("script".equals(req.type())) for (var f : List.of(java.util.Map.entry("genre", DirectorPrompts.GENRES), java.util.Map.entry("tone", DirectorPrompts.TONES))) {
            if (!o.has(f.getKey())) continue;
            String v = o.path(f.getKey()).asText("").trim();
            if (!v.isEmpty() && !f.getValue().containsKey(v)) throw invalid("不支持的" + ("genre".equals(f.getKey()) ? "题材" : "调性"));
            if (v.isEmpty()) c.putNull(f.getKey()); else c.put(f.getKey(), v);
        }
        refresh(c);
        dispatch(userId, w, c, req.type(), req.targetId(), "u-" + req.clientRequestId(), o, null, req.billing(), req.maxCost());
        save(w, c);
        return view(userId, w, c);
    }

    /**
     * 发一个任务。原生任务在独立事务里建好（失败不会把作品这一行的修改一起回滚），
     * 作品里记下这次任务的提示词、引用和输入指纹（taskMeta），结果回来时由 {@link #reconcile} 对照回投。包内可见供测试。
     */
    String dispatch(String userId, DirectorWork w, ObjectNode c, String type, String targetId, String requestId,
                            JsonNode o, ObjectNode pipeline, BillingSelection billing, Long maxCost) {
        String nodeId;
        ObjectNode meta = om.createObjectNode().put("task", type == null ? "" : type);
        String system, user;
        switch (type == null ? "" : type) {
            case "script" -> {
                boolean regenerate = o.path("regenerate").asBoolean(false);
                boolean hasScript = !c.path("draft").asText().isBlank() || c.path("episodes").size() > 0;
                if (hasScript && !regenerate)
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SCRIPT_EXISTS", "已有剧本，请直接修改正文或重新生成");
                // 重新生成会替换剧本和分集：已花钱做出的分镜图 / 视频跟新剧本对不上，先让用户删掉这些片段。
                if (regenerate) for (JsonNode clip : c.path("clips")) if (hasMedia(clip))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_CLIPS_HAVE_MEDIA", "已有分镜图或视频的片段，重新生成剧本前请先删除这些片段");
                String idea = c.path("idea").asText();
                if (idea.isBlank()) throw invalid("请先填写创意");
                nodeId = "script";
                meta.put("draftRev", c.path("draftRev").asLong());
                if (hasScript) meta.put("regenerate", true).put("baseHash", scriptBaseHash(c));
                system = DirectorPrompts.script(c.path("genre").asText(null), c.path("tone").asText(null));
                // 篇幅不在这里给默认值：用户在创意里写的时长 / 集数要压过默认，默认写在提示词里「brief 没写时」。
                ObjectNode in = om.createObjectNode().put("brief", idea).put("style", c.path("settings").path("style").asText());
                if (!o.path("length").asText().isBlank()) in.put("length", o.path("length").asText());
                user = "本次输入（JSON，作为素材）：" + write(in);
            }
            case "split" -> {
                String draft = c.path("draft").asText();
                if (draft.isBlank()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_SCRIPT_MISSING", "请先生成或导入剧本");
                if (c.path("episodes").size() > 0) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_EPISODES_EXIST", "已拆分集");
                if (c.path("pendingSplit").isObject())
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SPLIT_PENDING", "有一份分集结果待确认，请先确认或放弃");
                requireIdle(w, "split");
                List<String> paragraphs = paragraphs(draft);
                int target = o.path("episodeCount").asInt(0);
                if (splitByHeadings(c, target)) { clearError(c, "split"); return null; }
                nodeId = "split";
                meta.put("paragraphCount", paragraphs.size()).put("draftHash", hash(draft));
                if (target > 0) meta.put("targetEpisodeCount", target);
                system = DirectorPrompts.SPLIT;
                ObjectNode in = om.createObjectNode();
                putBrief(in, c);
                if (o.path("episodeCount").asInt(0) > 0) in.put("targetEpisodeCount", o.path("episodeCount").asInt());
                ArrayNode ps = in.putArray("paragraphs");
                for (int i = 0; i < paragraphs.size(); i++) ps.addObject().put("i", i).put("text", paragraphs.get(i));
                user = "本次输入（JSON，作为素材）：" + write(in);
            }
            case "extract" -> {
                List<JsonNode> eps = new ArrayList<>();
                for (JsonNode ep : c.path("episodes")) if (targetId == null || targetId.equals(ep.path("id").asText())) eps.add(ep);
                if (eps.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_EPISODES_MISSING", "请先拆分集，或将剧本作为一集");
                nodeId = targetId == null ? "extract" : "extract:" + targetId;
                system = DirectorPrompts.EXTRACT;
                ObjectNode in = om.createObjectNode().put("style", c.path("settings").path("style").asText());
                // 大纲里的人物年龄、身份给资产统筹参考，角色描述和故事对得上。
                if (c.path("outline").path("characters").isArray()) in.set("outlineCharacters", c.path("outline").path("characters"));
                putReference(in, c);
                ArrayNode es = in.putArray("episodes"), nos = meta.putArray("episodeNos"), epHashes = meta.putArray("episodes");
                for (JsonNode ep : eps) {
                    es.addObject().put("no", ep.path("no").asInt()).put("title", ep.path("title").asText()).put("content", ep.path("content").asText());
                    nos.add(ep.path("no").asInt());
                    epHashes.addObject().put("id", ep.path("id").asText()).put("contentHash", hash(ep.path("content").asText()));
                }
                ArrayNode ex = in.putArray("existingAssets"), exIds = meta.putArray("existingIds");
                for (JsonNode a : c.path("assets")) {
                    ex.addObject().put("id", a.path("id").asText()).put("kind", a.path("kind").asText()).put("name", a.path("name").asText())
                            .set("aliases", a.path("aliases"));
                    exIds.add(a.path("id").asText());
                }
                user = "本次输入（JSON，作为素材）：" + write(in);
            }
            case "plan" -> {
                ObjectNode ep = find(c, "episodes", targetId, "这一集");
                if (ep.path("content").asText().isBlank()) throw invalid("本集暂无正文");
                for (JsonNode clip : c.path("clips"))
                    if (targetId.equals(clip.path("episodeId").asText()) && hasMedia(clip))
                        throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_CLIPS_HAVE_MEDIA", "本集片段已有分镜图或视频，重写分镜脚本会丢掉这些内容。请先删除不需要的片段");
                if (c.path("assets").isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_ASSETS_MISSING", "请先在「资产」中提取或添加角色、场景和道具");
                Limits lim = limits(c);
                if (lim == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTOR_VIDEO_MODEL_UNAVAILABLE",
                        "暂无支持片段生成的视频模型，无法确定片段时长。请联系管理员开通");
                nodeId = "plan:" + targetId;
                meta.put("episodeId", targetId).put("contentHash", hash(ep.path("content").asText()))
                        .put("clipsHash", clipsHash(c, targetId));
                ObjectNode in = om.createObjectNode().put("aspectRatio", c.path("settings").path("aspectRatio").asText())
                        .put("episodeNo", ep.path("no").asInt()).put("content", ep.path("content").asText());
                putBrief(in, c);
                ArrayNode as = in.putArray("assets");
                for (JsonNode a : c.path("assets")) {
                    as.addObject().put("id", a.path("id").asText()).put("kind", a.path("kind").asText()).put("name", a.path("name").asText())
                            .put("description", a.path("description").asText());
                }
                meta.set("assetIds", om.valueToTree(ids(c.path("assets"))));
                List<String> chars = new ArrayList<>();
                for (JsonNode a : c.path("assets")) if ("character".equals(a.path("kind").asText())) chars.add(a.path("id").asText());
                meta.set("characterIds", om.valueToTree(chars));
                system = DirectorPrompts.plan(lim.min(), lim.max(), lim.maxShots());
                user = "本次输入（JSON，作为素材）：" + write(in);
            }
            case "asset-image" -> {
                ObjectNode a = find(c, "assets", targetId, "这个资产");
                String prompt = a.path("prompt").asText();
                if (prompt.isBlank()) throw invalid("请先填写资产描述");
                String refKey = characterRefKey(a);
                List<Bound> refs = refKey == null ? List.of()
                        : List.of(new Bound(targetId, a.path("name").asText() + "的形象参考", "character", refKey, "图1"));
                if (refKey != null) prompt = prompt + "\n" + DirectorPrompts.CHARACTER_REF_NOTE;
                return image(userId, w, c, "asset:" + targetId, requestId, prompt, refs, sizeFor(c, a.path("kind").asText()),
                        assetFingerprint(a), pipeline, billing, maxCost);
            }
            case "board" -> {
                ObjectNode clip = find(c, "clips", targetId, "这个片段");
                if (clip.path("issues").size() > 0) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CLIP_NEEDS_FIX",
                        "该片段需先修改：" + clip.path("issues").get(0).asText());
                List<Bound> refs = boundRefs(c, clip, true);
                return image(userId, w, c, "board:" + targetId, requestId, clip.path("boardPrompt").asText(), refs, sizeFor(c, "board"),
                        boardCurrent(c, clip).fingerprint(), pipeline, billing, maxCost);
            }
            case "video" -> { return video(userId, w, c, find(c, "clips", targetId, "这个片段"), requestId, pipeline, billing, maxCost, o.path("promptChoice").asText(null)); }
            case "export" -> { return export(userId, w, c, targetId, requestId); }
            default -> throw invalid("不支持的生成");
        }
        requireIdle(w, nodeId);
        meta.put("targetId", targetId);
        final String fSystem = system, fUser = user, fNode = nodeId;
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), fNode, fSystem, fUser, requestId, meta, textModel(c), billing, maxCost));
        clearError(c, nodeId);
        track(c, pipeline, run.id(), om.createObjectNode().put("node", nodeId));
        w.setActive(true);
        return run.id();
    }

    private record Bound(String assetId, String name, String kind, String key, String label) {}

    /** 片段实际用到的参考图：角色 → 场景 → 道具，每个都要有已采用的图；缺了就报具体是哪个。 */
    /**
     * 分镜节奏的程序检查（不靠模型自检）：台词量、镜头数、单镜时长、相邻景别、片段时长，规则同「写分镜脚本」提示词。
     * 只是提示，不进 issues、不拦截出图，也不自动重写；只按首帧出片的模型一段一个镜头，只查台词量。
     */
    private ArrayNode shotWarnings(JsonNode clip, Limits lim, double total, int lastOrderInEpisode) {
        ArrayNode out = om.createArrayNode();
        JsonNode shots = clip.path("shots");
        if (lim == null || shots.isEmpty()) return out;
        // 台词量：视频模型每秒约说 4 个字，太密会被吞掉（2026-10-26「通道对话」7 秒 69 字，整句没了）；两人同一镜说话也容易串。
        List<String> dense = new ArrayList<>(), twoSpeakers = new ArrayList<>();
        for (int i = 0; i < shots.size(); i++) {
            JsonNode s = shots.get(i);
            long chars = 0;
            Set<String> speakers = new HashSet<>();
            for (JsonNode l : s.path("dialogue")) {
                chars += l.path("text").asText().codePoints().filter(Character::isLetterOrDigit).count();
                speakers.add(l.path("speakerId").asText(""));
            }
            double d = s.path("durationSec").asDouble();
            if (chars > 0 && d > 0 && chars > d * 4) dense.add("第 " + (i + 1) + " 镜 " + fmt(d) + " 秒 " + chars + " 字");
            if (speakers.size() > 1) twoSpeakers.add("第 " + (i + 1) + " 镜");
        }
        if (!dense.isEmpty()) out.add(String.join("、", dense) + "：台词超过每秒 4 字容易说不完或被吞掉，挪一部分到下一镜或延长镜头");
        if (!twoSpeakers.isEmpty()) out.add(String.join("、", twoSpeakers) + "有两个人说话：拆成说、答两个镜头更稳");
        if (lim.frame()) return out;
        int lo = Math.min(3, lim.maxShots());
        if (shots.size() < lo) out.add("只有 " + shots.size() + " 个镜头，每段至少 " + lo + " 个：补一个反应镜头或细节特写");
        List<String> longShots = new ArrayList<>(), sameSize = new ArrayList<>();
        String prev = null;
        for (int i = 0; i < shots.size(); i++) {
            JsonNode s = shots.get(i);
            double d = s.path("durationSec").asDouble();
            if (d > 4) longShots.add("第 " + (i + 1) + " 镜 " + fmt(d) + " 秒");
            String size = s.path("size").asText().trim();
            if (prev != null && !size.isEmpty() && size.equals(prev)) sameSize.add("第 " + i + "、" + (i + 1) + " 镜都是" + size);
            prev = size;
        }
        if (!longShots.isEmpty()) out.add(String.join("、", longShots) + "：常规镜头 2–4 秒，更长要有理由（长动作、情绪定格）");
        if (!sameSize.isEmpty()) out.add(String.join("；", sameSize) + "：相邻镜头要换景别");
        int target = Math.max(lim.min(), lim.max() - 3);
        if (total < target && clip.path("order").asInt() != lastOrderInEpisode)
            out.add("片段 " + fmt(total) + " 秒，建议 " + target + "–" + lim.max() + " 秒，用满单段时长");
        return out;
    }

    /**
     * 片段要交给模型的画面资产，固定顺序：角色 → 场景 → 道具，同类按片段里的顺序，只出声音的不算。
     * 提示词里的「图N」（refresh）和真正提交的参考图（boundRefs）都从这里取，两边编号不会错位。
     */
    private List<JsonNode> visualAssets(ObjectNode c, JsonNode clip) {
        List<JsonNode> out = new ArrayList<>();
        for (String kind : List.of("character", "scene", "prop"))
            for (JsonNode idNode : clip.path("assetIds")) {
                JsonNode a = findOrNull(c, "assets", idNode.asText());
                if (a != null && kind.equals(a.path("kind").asText()) && !audioOnly(a)) out.add(a);
            }
        return out;
    }

    private List<Bound> boundRefs(ObjectNode c, JsonNode clip, boolean requireConfirmed) {
        List<Bound> out = new ArrayList<>();
        List<String> missing = new ArrayList<>(), unconfirmed = new ArrayList<>();
        for (JsonNode a : visualAssets(c, clip)) {
            String key = adoptedKey(a.path("image"));
            if (key == null) { missing.add(a.path("name").asText()); continue; }
            if (requireConfirmed && "auto".equals(a.path("image").path("adoptedBy").asText())) unconfirmed.add(a.path("name").asText());
            out.add(new Bound(a.path("id").asText(), a.path("name").asText(), a.path("kind").asText(), key, "图" + (out.size() + 1)));
        }
        if (!missing.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_REFERENCE_MISSING",
                "缺少参考图：" + String.join("、", missing) + "。请在「资产」中生成或上传", Map.of("names", missing));
        if (!unconfirmed.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_REFERENCE_UNCONFIRMED",
                "参考图待确认：" + String.join("、", unconfirmed) + "。请在「资产」中确认", Map.of("names", unconfirmed));
        return out;
    }

    private String image(String userId, DirectorWork w, ObjectNode c, String nodeId, String requestId, String prompt,
                         List<Bound> refs, String size, String fingerprint, ObjectNode pipeline, BillingSelection billing, Long maxCost) {
        requireIdle(w, nodeId);
        requireRefCapacity(c, refs.size());
        List<String> keys = new ArrayList<>();
        refs.forEach(r -> keys.add(r.key()));
        String runId;
        if (fixtures.enabled()) runId = newTx.execute(tx -> fixtureMedia(userId, w.getId(), nodeId, requestId, "image", prompt));
        else runId = newTx.execute(tx -> imageRuns.generateForDirector(userId, w.getId(),
                new IpRunService.IpGenerateRequest(nodeId, prompt, keys, 1, size, imageSelection(c).resolved().endpoint().getId(), maxCost, billing, requestId)).id());
        ObjectNode m = om.createObjectNode().put("node", nodeId).put("prompt", prompt).put("fingerprint", fingerprint);
        ArrayNode rs = m.putArray("refs");
        refs.forEach(r -> rs.addObject().put("assetId", r.assetId()).put("name", r.name()).put("label", r.label()).put("key", r.key()));
        clearError(c, nodeId);
        track(c, pipeline, runId, m);
        w.setActive(true);
        return runId;
    }

    /**
     * 没有保存出图规格的出图模型（走 dap 多模态链，如 Agnes Image）只收前 N 张参考图、多的会被跳过；
     * 导演台的参考图都是必须的，超了就在提交前说清楚，不让模型悄悄少看几张。
     */
    private void requireRefCapacity(ObjectNode c, int count) {
        if (count == 0 || fixtures.enabled()) return;
        var endpoint = imageSelection(c).resolved().endpoint();
        if (com.aistareco.aep.ipstudio.service.JusuanImageClient.supports(endpoint)) return; // 按出图规格校验，超限会明确报错
        int max = studioProps.getMaxRefImages();
        if (count > max) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_TOO_MANY_REFERENCES",
                "需要 " + count + " 张参考图，当前图片模型最多支持 " + max + " 张。请减少关联资产或拆分片段");
    }

    /** 测试响应：零成本假图 / 假视频，走既有的 Studio 测试路径，产物标 mock。 */
    private String fixtureMedia(String userId, String workId, String nodeId, String requestId, String operation, String prompt) {
        ObjectNode input = om.createObjectNode().put("operation", operation).put("mock", true).put("prompt", prompt).put("count", 1);
        return workflowRun(userId, workId, nodeId, requestId, "studio-" + operation, input);
    }

    /** 零成本的 Studio 工作流任务（测试响应出图出片、整集合成），afterCommit 派发；同一请求编号重放返回原任务。 */
    private String workflowRun(String userId, String workId, String nodeId, String requestId, String kind, ObjectNode input) {
        var prior = runs.findByProjectIdAndClientRequestId(workId, requestId).orElse(null);
        if (prior != null) return prior.getId();
        String id = "IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        input.putObject("_exec").put("holdTotal", 0).put("unitCost", 0);
        runs.save(IpRun.builder().id(id).projectId(workId).hostType(IpRun.HOST_DIRECTOR).ownerUserId(userId).nodeId(nodeId)
                .kind(kind).status(IpRun.STATUS_RUNNING).stage("queued").cost(0).clientRequestId(requestId)
                .inputJson(write(input)).outputJson("{}").createdAt(Instant.now()).heartbeatAt(Instant.now()).build());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { try { workflowWorker.execute(id); } catch (RuntimeException e) { workflowWorker.reject(id, e); } }
        });
        return id;
    }

    // ── 片段视频 ─────────────────────────────────────────────────────────────

    /** 一次片段视频请求的全部输入：分镜板 + 资产参考图 + 说话角色的声音样本，都按已采用版本解析。 */
    private record VideoInput(String prompt, int durationSec, String aspect, Limits lim, List<VideoStudioReferenceInput> refs,
                              ArrayNode refsMeta, String fingerprint, String firstFrame) {
        /** 交给模型的是改写后的英文稿；指纹、候选上记的提示词仍是用户看到的中文。 */
        VideoInput withPrompt(String sent) {
            return new VideoInput(sent, durationSec, aspect, lim, refs, refsMeta, fingerprint, firstFrame);
        }

        IpRunService.IpVideoRequest request(String requestId, Long maxCost, BillingSelection billing) {
            // 首帧出片：走画布原有的单首帧路径（refKey → first_frame_key），只交这一张分镜画面。
            if (lim.frame()) return new IpRunService.IpVideoRequest(prompt, firstFrame, durationSec, aspect, lim.model(), maxCost, null, billing, requestId);
            var settings = new com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings(VIDEO_MODE, lim.tier(), null, null, null, refs,
                    lim.optimizable() ? Boolean.FALSE : null);
            return new IpRunService.IpVideoRequest(prompt, null, durationSec, aspect, lim.model(), maxCost, settings, billing, requestId);
        }
    }

    private VideoInput videoInput(ObjectNode c, JsonNode clip) {
        if (clip.path("issues").size() > 0) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CLIP_NEEDS_FIX",
                "该片段需先修改：" + clip.path("issues").get(0).asText());
        JsonNode boardSlot = clip.path("board");
        String board = adoptedKey(boardSlot);
        if (board == null) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_BOARD_MISSING", "请先生成并确认分镜图");
        if ("auto".equals(boardSlot.path("adoptedBy").asText())) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_BOARD_UNCONFIRMED", "请先确认分镜图");
        Limits lim = limits(c);
        if (lim == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTOR_VIDEO_MODEL_UNAVAILABLE",
                "暂无支持片段生成的视频模型，请联系管理员开通");
        String aspect = c.path("settings").path("aspectRatio").asText("9:16");
        if (!lim.aspects().isEmpty() && !lim.aspects().contains(aspect))
            throw invalid("视频模型「" + lim.name() + "」不支持 " + aspect + " 画幅，请在设置中更换画幅或模型");
        int duration = (int) Math.round(clip.path("durationSec").asDouble());
        if (lim.frame()) {
            List<String> voiced = voicedNames(c, clip);
            if (!voiced.isEmpty() && !clip.path("videoWithoutVoice").asBoolean(false))
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_VOICE_UNSUPPORTED",
                        "视频模型「" + lim.name() + "」不支持声音参考，" + String.join("、", voiced) + "的声音本次不使用。请勾选「不带声音参考生成」", Map.of("names", voiced));
            ArrayNode meta = om.createArrayNode();
            meta.addObject().put("label", "首帧").put("name", "分镜画面").put("key", board).putNull("assetId");
            return new VideoInput(clip.path("videoPrompt").asText(), duration, aspect, lim, List.of(), meta, videoCurrent(c, clip, lim).fingerprint(), board);
        }
        List<Bound> assets = boundRefs(c, clip, true);
        List<VideoStudioReferenceInput> refs = new ArrayList<>();
        ArrayNode meta = om.createArrayNode();
        refs.add(new VideoStudioReferenceInput("image", board));
        meta.addObject().put("label", "图1").put("name", "分镜图").put("key", board).putNull("assetId");
        for (Bound b : assets) {
            refs.add(new VideoStudioReferenceInput("image", b.key()));
            meta.addObject().put("label", "图" + refs.size()).put("name", b.name()).put("key", b.key()).put("assetId", b.assetId());
        }
        int audio = 0;
        for (JsonNode a : speakers(c, clip)) {
            String key = a.path("voice").path("key").asText(null);
            if (key == null) continue;
            refs.add(new VideoStudioReferenceInput("audio", key));
            meta.addObject().put("label", "音频" + (++audio)).put("name", a.path("name").asText() + "的声音").put("key", key).put("assetId", a.path("id").asText());
        }
        String prompt = clip.path("videoPrompt").asText();
        return new VideoInput(prompt, duration, aspect, lim, refs, meta, videoCurrent(c, clip, lim).fingerprint(), null);
    }

    /** 片段视频报价：和真正提交走同一份输入与同一个报价函数。测试响应下为 0。 */
    long videoQuote(String userId, ObjectNode c, JsonNode clip) {
        Limits lim = limits(c);
        if (lim != null && lim.frame() && !fixtures.enabled()) {
            // 首帧出片的价格只跟模型和时长有关：分镜画面还没确认时也能先看价格。
            if (clip.path("issues").size() > 0) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CLIP_NEEDS_FIX",
                    "该片段需先修改：" + clip.path("issues").get(0).asText());
            return videoJobs.studioLegacyQuote(lim.model(), (int) Math.round(clip.path("durationSec").asDouble()));
        }
        VideoInput in = videoInput(c, clip);
        if (fixtures.enabled()) return 0;
        // 报价只含视频：H3 提交前的提示词改写按实际用量另扣（文字模型，花费很少），界面上明说，不进报价（2026-10-26 用户定）。
        return videoModels.quote(userId, in.request(null, null, null));
    }

    /** 片段里说台词、并且绑了声音的角色名。 */
    private List<String> voicedNames(ObjectNode c, JsonNode clip) {
        List<String> out = new ArrayList<>();
        for (JsonNode a : speakers(c, clip)) if (a.path("voice").path("key").isTextual()) out.add(a.path("name").asText());
        return out;
    }

    /**
     * {@code choice}：用户在「优化稿有需要留意的地方」时选的 optimized / original；null 按已记下的选择或默认走。
     * 一键制作（{@code pipeline != null}）不停下来问：优化稿能用就用，用不了（超长）按原文。
     */
    private String video(String userId, DirectorWork w, ObjectNode c, ObjectNode clip, String requestId, ObjectNode pipeline,
                         BillingSelection billing, Long maxCost, String choice) {
        String node = "video:" + clip.path("id").asText();
        requireIdle(w, node);
        if (clip.path("video").path("pending").size() > 0) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "该片段视频生成中，请稍候");
        if (choice != null && !Set.of("optimized", "original").contains(choice)) throw invalid("不支持的提示词选择");
        VideoInput in = videoInput(c, clip);
        String sent = null;
        boolean original = false;
        if (h3(in.lim())) {
            Rewrite rw = rewrite(c, clip);
            if (choice != null) remember(clip, rw, choice);
            String chosen = choice(clip, rw);
            JsonNode en = optimized(clip, rw);
            original = "original".equals(chosen);
            if (!original && en == null) return rewriteFirst(userId, w, c, clip, rw, in.fingerprint(), requestId, pipeline, billing, maxCost);
            if (!original) {
                boolean usable = en.path("usable").asBoolean(true);
                if (!usable && pipeline != null) original = true;
                else if (!usable) throw invalid("优化稿超过 " + H3PromptRewrite.MAX_PROMPT_CHARS + " 字符，H3 收不下。请缩短台词或拆分片段，或按原文生成");
                else if (!en.path("warnings").isEmpty() && pipeline == null && !"optimized".equals(chosen))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_PROMPT_REVIEW", "优化稿有需要留意的地方，请先选择用优化稿还是原文生成");
                else sent = english(en, rw);
            }
            if (sent != null && sent.length() > H3PromptRewrite.MAX_PROMPT_CHARS)
                throw invalid("台词加起来太长，发给视频模型的提示词超过 " + H3PromptRewrite.MAX_PROMPT_CHARS + " 字符。请缩短台词或拆分片段，或按原文生成");
        }
        ObjectNode m = om.createObjectNode().put("node", node).put("prompt", in.prompt()).put("fingerprint", in.fingerprint())
                .put("promptFormat", DirectorPrompts.VIDEO_PROMPT_FORMAT);
        if (sent != null) m.put("sentPrompt", sent);
        if (original) m.put("promptChoice", "original");
        m.set("refs", in.refsMeta());
        clearError(c, node);
        w.setActive(true);
        VideoInput submit = sent == null ? in : in.withPrompt(sent);
        if (fixtures.enabled()) {
            String runId = newTx.execute(tx -> fixtureMedia(userId, w.getId(), node, requestId, "video", submit.prompt()));
            track(c, pipeline, runId, m);
            return runId;
        }
        JsonNode job = newTx.execute(tx -> imageRuns.generateVideoForDirector(userId, w.getId(), node, submit.request(requestId, maxCost, billing)));
        String jobId = job.path("id").asText();
        ObjectNode entry = ((ObjectNode) clip.path("video")).withArray("pending").addObject().put("jobId", jobId).put("at", Instant.now().toString())
                .put("stage", job.path("stage").asText("已入队")).put("pct", job.path("progress_pct").asInt(0));
        entry.set("meta", m);
        if (pipeline != null) pipeline.withArray("videoJobs").addObject().put("jobId", jobId).put("estimate", maxCost == null ? 0 : maxCost);
        return jobId;
    }

    // ── H3 视频提示词改写 ───────────────────────────────────────────────────
    // 用户看到、能改的是中文视频提示词；提交 H3 前统一用后台视频提示词优化绑定模型 按官方 skill 改写成英文（与 Studio 画布、助手共用），
    // 台词与说话人编号由代码填。检查只给提示、不拦人：有提示时手动生成先请用户选用优化稿还是原文，一键制作照常继续。
    // 依据：docs/audits/director-h3-video-prompt-ab-2026-10.md §6。

    static final String REWRITE_NODE = "videoPrompt:";

    /** 官方写法只用在 H3 上：目前只有聚算 H3 带「支持厂商提示词优化」；只按首帧出片的模型不改写。 */
    private static boolean h3(Limits lim) {
        return lim != null && !lim.frame() && lim.optimizable();
    }

    /**
     * 一次改写的全部输入。{@code hash} 只管画面与结构（中文原文里台词已换成占位）：不变就复用已存的英文模板，
     * 台词按当前文字现场填 —— 只改台词不用重新改写。
     */
    private record Rewrite(String system, String user, String hash, ObjectNode meta, List<H3PromptRewrite.Line> lines, String language) {}

    private Rewrite rewrite(ObjectNode c, JsonNode clip) {
        List<String> known = new ArrayList<>(List.of("旁白"));
        for (JsonNode a : c.path("assets")) if ("character".equals(a.path("kind").asText())) known.add(a.path("name").asText());
        int shots = Math.min(clip.path("shots").size(), DirectorPrompts.MAX_SHOTS);
        boolean grid = DirectorPrompts.boardLayout(clip.path("shots").size())[0] == 2;
        // 参考素材清单与提交顺序一致（videoInput）：图1 分镜图，资产按角色 → 场景 → 道具，音频按说话人第一次开口的顺序。
        List<String> refs = new ArrayList<>();
        refs.add("<Picture 1>: " + (grid
                ? "a 2x2 storyboard grid; top-left panel = Shot 1, top-right = Shot 2, bottom-left = Shot 3, bottom-right = Shot 4"
                  + (shots < 4 ? " (panels without a shot are empty)" : "") + ". Use it only for viewpoint, subject placement and shot order."
                : "the storyboard frame of this clip. Use it only for viewpoint, subject placement and composition."));
        int pictures = 1;
        for (JsonNode a : visualAssets(c, clip)) {
            pictures++;
            String name = a.path("name").asText(), notes = a.path("description").asText().strip();
            String what = switch (a.path("kind").asText()) {
                case "scene" -> "reference image of the location 「" + name + "」";
                case "prop" -> "reference image of the prop 「" + name + "」";
                default -> "character sheet of 「" + name + "」; every figure on the sheet is the same person";
            };
            refs.add("<Picture " + pictures + ">: " + what + "." + (notes.isEmpty() ? "" : " Written notes: " + notes));
        }
        int audios = 0;
        for (JsonNode a : speakers(c, clip)) if (a.path("voice").path("key").isTextual())
            refs.add("<Audio " + (++audios) + ">: voice sample of 「" + a.path("name").asText() + "」; use only its timbre and delivery.");
        String zh = clip.path("videoPrompt").asText();
        H3PromptRewrite.Source src = H3PromptRewrite.source(zh, known);
        List<String> planned = new ArrayList<>();
        for (JsonNode s : clip.path("shots")) for (JsonNode l : s.path("dialogue")) planned.add(l.path("text").asText());
        // 台词由代码按原文填回去，前提是认得全：自动生成的提示词逐句核对原文（台词里的引号没配上会少认半句，句数还对得上），
        // 用户改写过的核对句数与引号是否成对。认不全就改由模型照官方写法自己写台词、逐句核对后给提示（不再拒绝，2026-10-26 用户定）。
        boolean custom = clip.path("videoPromptCustom").asBoolean(false), legacy = !src.text().contains("说：{{");
        boolean codeLines = src.lines().size() >= planned.size()
                && (custom ? src.lines().isEmpty() || H3PromptRewrite.quotesBalanced(src.text(), legacy)
                           : src.lines().stream().map(H3PromptRewrite.Line::text).toList().equals(planned));
        if (!codeLines) src = new H3PromptRewrite.Source(zh, List.of());
        List<Double> starts = new ArrayList<>();
        double t = 0;
        for (int i = 0; i < shots; i++) { starts.add(t); t += clip.path("shots").get(i).path("durationSec").asDouble(); }
        var req = new H3PromptRewrite.Request(H3PromptRewrite.Mode.REF, (int) Math.round(clip.path("durationSec").asDouble()), refs, src, codeLines,
                shots, starts, c.path("settings").path("language").asText(null), true);
        String user = H3PromptRewrite.user(req);
        // 镜头切换时间点拼在英文模板里（[Shot N] At MM:SS），不在用户消息里：要单独算进指纹，改了镜头时长就重新改写。
        String h = hash(H3PromptRewrite.VERSION + "|" + starts + "|" + user);
        ObjectNode meta = H3PromptRewrite.meta(om, req, pictures, 0, audios).put("hash", h).put("targetId", clip.path("id").asText());
        return new Rewrite(H3PromptRewrite.system(H3PromptRewrite.Mode.REF, codeLines, true), user, h, meta, src.lines(), meta.path("language").asText());
    }

    /** 已存、并且和当前画面结构与参考素材对得上的改写结果（{@code template / warnings / usable}）；没有就 null。 */
    private static JsonNode optimized(JsonNode clip, Rewrite rw) {
        JsonNode en = clip.path("videoPromptEn");
        return en.isObject() && rw.hash().equals(en.path("hash").asText()) && en.path("template").isTextual() ? en : null;
    }

    /** 英文稿，台词按当前文字填好。 */
    private static String english(JsonNode en, Rewrite rw) {
        return H3PromptRewrite.fill(en.path("template").asText(), rw.lines(), rw.language());
    }

    /** 用户对这一版提示词选过的 optimized / original；提示词或素材改了（指纹变了）就作废。 */
    private static String choice(JsonNode clip, Rewrite rw) {
        JsonNode ch = clip.path("videoPromptChoice");
        return ch.isObject() && rw.hash().equals(ch.path("hash").asText()) ? ch.path("value").asText(null) : null;
    }

    private void remember(ObjectNode clip, Rewrite rw, String value) {
        clip.putObject("videoPromptChoice").put("hash", rw.hash()).put("value", value).put("at", Instant.now().toString());
    }

    private long rewritePrice() {
        return fixtures.enabled() ? 0 : textRuns.videoRewriteHold();
    }

    /**
     * 给界面：off = 不改写（非 H3）；needed = 提交时会先改写；ready = 英文稿已备好，直接提交；
     * review = 英文稿有需要留意的地方（或超长），等用户选用优化稿还是原文；original = 用户选了按原文生成。
     * 有英文稿时把填好当前台词的英文放进 {@code videoPromptEn.text}，界面展开看到的就是会发出去的那一份。
     */
    private String rewriteState(ObjectNode c, ObjectNode clip, Limits lim) {
        if (!h3(lim)) return "off";
        Rewrite rw;
        try { rw = rewrite(c, clip); }
        catch (BusinessException e) { return "needed"; }
        JsonNode en = optimized(clip, rw);
        if (en == null && clip.path("videoPromptEn").isObject()) ((ObjectNode) clip.path("videoPromptEn")).remove("text");
        String chosen = choice(clip, rw);
        if ("original".equals(chosen)) return "original";
        if (en == null) return "needed";
        ((ObjectNode) en).put("text", english(en, rw));
        return !en.path("usable").asBoolean(true) || !en.path("warnings").isEmpty() && !"optimized".equals(chosen) ? "review" : "ready";
    }

    /**
     * 还没有英文稿：先发改写任务，完成后由 {@link #chainVideo} 接着提交视频。
     * 用户确认的是视频价格（原样留给视频）；改写不报价，按文本模型自己的上限冻结、按实际用量结算，界面上提示会额外消耗少量积分。
     */
    private String rewriteFirst(String userId, DirectorWork w, ObjectNode c, ObjectNode clip, Rewrite rw, String fingerprint, String requestId,
                                ObjectNode pipeline, BillingSelection billing, Long maxCost) {
        String clipId = clip.path("id").asText(), node = REWRITE_NODE + clipId;
        requireIdle(w, node);
        long price = rewritePrice();
        // fingerprint 是这次要付费提交的视频输入（中文提示词含台词、分镜图、参考图与声音的 key、时长、画幅、模型）：改写期间变了就不接着提交。
        ObjectNode then = rw.meta().putObject("then").put("requestId", requestId).put("fingerprint", fingerprint);
        if (maxCost != null) then.put("maxCost", maxCost); else then.putNull("maxCost");
        if (billing != null) then.set("billing", om.valueToTree(billing));
        if (pipeline != null) then.put("pipelineId", pipeline.path("id").asText());
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), node, rw.system(), rw.user(),
                requestId + "-p", rw.meta(), null, billing, price));
        clearError(c, "video:" + clipId);
        track(c, pipeline, run.id(), om.createObjectNode().put("node", node));
        w.setActive(true);
        return run.id();
    }

    /**
     * 改写稿没通过校验（{@code AI_BAD_OUTPUT}，这一次不扣费）时用同样的输入自动再改写一次，用户看不到这次失败；
     * 第二次还不过才报错。画面结构在这期间改了就不重试。2026-10-26 线上 21 段评测：单次通过率在放宽前约七成。
     */
    private boolean retryRewrite(DirectorWork w, ObjectNode c, IpRun run) {
        if (!"AI_BAD_OUTPUT".equals(run.getErrorCode())) return false;
        JsonNode in = parse(run.getInputJson()).path("_director");
        if (in.path("attempt").asInt(1) >= 2) return false;
        ObjectNode clip = (ObjectNode) findOrNull(c, "clips", in.path("targetId").asText());
        if (clip == null) return false;
        Rewrite rw;
        try { rw = rewrite(c, clip); } catch (BusinessException e) { return false; }
        if (!rw.hash().equals(in.path("hash").asText())) return false;
        JsonNode then = in.path("then");
        if (then.isObject()) rw.meta().set("then", then.deepCopy());
        rw.meta().put("attempt", 2);
        ObjectNode pipeline = null;
        JsonNode p = c.path("pipeline");
        if (then.hasNonNull("pipelineId")) {
            // 一键制作已暂停或停止：不再发新任务（重试也要冻结积分），按失败记下，恢复后可「重试失败项」。
            if (!p.isObject() || !then.path("pipelineId").asText().equals(p.path("id").asText()) || !"running".equals(p.path("status").asText())) return false;
            pipeline = (ObjectNode) p;
        }
        BillingSelection billing = then.hasNonNull("billing") ? om.convertValue(then.path("billing"), BillingSelection.class) : null;
        String node = run.getNodeId(), requestId = then.path("requestId").asText(run.getClientRequestId()) + "-p2";
        try {
            long price = rewritePrice();
            // 一键制作的预算：这次重试的冻结加上之后要提交的视频报价都要放得下（文本模型可能在这期间换过、价格变了）。
            if (pipeline != null && pipelineSpent(pipeline) + price + then.path("maxCost").asLong(0) > pipeline.path("budget").asLong()) {
                log.info("[director] 提示词改写未通过校验，预算放不下重试 work={} node={}", w.getId(), node);
                return false;
            }
            var retry = newTx.execute(tx -> textRuns.submitDirectorText(run.getOwnerUserId(), w.getId(), node, rw.system(), rw.user(), requestId, rw.meta(), null, billing, price));
            track(c, pipeline, retry.id(), om.createObjectNode().put("node", node));
            w.setActive(true);
            log.info("[director] 提示词改写未通过校验，自动重试 work={} node={} failed={} retry={}", w.getId(), node, run.getId(), retry.id());
            return true;
        } catch (BusinessException e) {
            log.warn("[director] 提示词改写重试提交失败 work={} node={} reason={}", w.getId(), node, e.getMessage());
            return false;
        }
    }

    /**
     * 改写两次都没成功、又是一键制作在跑：不停下来，按原文接着提交视频（不阻断，2026-10-26 用户定）。手动生成的照常报错，
     * 片段上可以「按原文生成」。
     */
    private boolean originalInPipeline(DirectorWork w, ObjectNode c, IpRun run) {
        JsonNode in = parse(run.getInputJson()).path("_director"), then = in.path("then"), p = c.path("pipeline");
        if (!then.hasNonNull("pipelineId") || !p.isObject() || !then.path("pipelineId").asText().equals(p.path("id").asText())
                || !"running".equals(p.path("status").asText())) return false;
        ObjectNode clip = (ObjectNode) findOrNull(c, "clips", in.path("targetId").asText());
        if (clip == null) return false;
        log.info("[director] 提示词改写两次未成功，一键制作按原文提交 work={} clip={}", w.getId(), clip.path("id").asText());
        notice(c, "「" + clip.path("title").asText() + "」的提示词优化没成功，已按原文生成");
        chainVideo(w, c, clip, then, "original");
        return true;
    }

    /**
     * 改写完成后接着提交视频，用点「生成视频」时确认过的价格与付款方。改写期间提示词或参考素材改了就不提交，请用户重新生成；
     * 一键制作已暂停或停止也不提交（英文稿留着，恢复后直接用）。
     */
    private void chainVideo(DirectorWork w, ObjectNode c, ObjectNode clip, JsonNode then) { chainVideo(w, c, clip, then, null); }

    /** {@code choice} = original：改写两次都没成功，一键制作按原文接着提交。 */
    private void chainVideo(DirectorWork w, ObjectNode c, ObjectNode clip, JsonNode then, String choice) {
        if (!then.isObject()) return;
        String clipId = clip.path("id").asText(), node = "video:" + clipId;
        refresh(c);
        ObjectNode pipeline = null;
        if (then.hasNonNull("pipelineId")) {
            JsonNode p = c.path("pipeline");
            if (!p.isObject() || !then.path("pipelineId").asText().equals(p.path("id").asText()) || !"running".equals(p.path("status").asText())) return;
            pipeline = (ObjectNode) p;
        }
        Long maxCost = then.hasNonNull("maxCost") ? then.path("maxCost").asLong() : null;
        String refused = null;
        try {
            VideoInput in = videoInput(c, clip);
            Rewrite rw = h3(in.lim()) ? rewrite(c, clip) : null;
            JsonNode en = rw == null ? null : optimized(clip, rw);
            if (rw == null || choice == null && en == null
                    || then.hasNonNull("fingerprint") && !then.path("fingerprint").asText().equals(in.fingerprint()))
                refused = "改写期间提示词、台词或参考素材有改动，视频没有提交，请重新生成";
            else if (choice == null && pipeline == null && (!en.path("usable").asBoolean(true) || !en.path("warnings").isEmpty())) {
                // 有需要留意的地方：不替用户花视频的钱，停在「用优化稿 / 用原文」的选择上（片段卡片上显示提示）。
                notice(c, "「" + clip.path("title").asText() + "」的优化稿有需要留意的地方，请在分镜里选择用优化稿还是原文生成");
                return;
            }
        } catch (BusinessException e) { refused = e.getMessage(); }
        if (refused == null && pipeline != null) {
            // 一键制作的总预算：改写按实际用量扣了之后，视频报价要还放得下；放不下就停在预算不足，提高预算后由推进重新报价提交。
            long spent = pipelineSpent(pipeline), need = maxCost == null ? 0 : maxCost;
            if (spent + need > pipeline.path("budget").asLong()) {
                pipeline.put("status", "waiting").put("stage", "budget").put("message",
                        "预算不足：已用 " + spent + " 积分，下一步约需 " + need + " 积分。提高预算后可继续");
                return;
            }
        }
        if (refused == null) {
            BillingSelection billing = then.hasNonNull("billing") ? om.convertValue(then.path("billing"), BillingSelection.class) : null;
            try { video(w.getOwnerUserId(), w, c, clip, then.path("requestId").asText(), pipeline, billing, maxCost, choice); return; }
            catch (BusinessException e) { refused = e.getMessage(); }
        }
        setError(c, node, refused);
        // 记成失败项：否则同一轮推进会当它还没做，换个请求号重新报价提交（价格涨了就绕过了用户确认的价格）。
        if (pipeline != null) pipeline.withArray("failed").add(node);
    }

    /** 查询在跑的片段视频任务，完成的放进候选（输入没变才自动填采用位），失败的写清原因。返回是否有变化。 */
    private boolean pollVideos(DirectorWork w, ObjectNode c, boolean[] running) {
        boolean changed = false;
        for (JsonNode clipNode : c.path("clips")) {
            ObjectNode slot = (ObjectNode) clipNode.path("video");
            ArrayNode pending = slot.withArray("pending");
            for (int i = pending.size() - 1; i >= 0; i--) {
                ObjectNode entry = (ObjectNode) pending.get(i);
                JsonNode job;
                try { job = videoJobs.getJob(entry.path("jobId").asText(), w.getOwnerUserId(), MaterialVideoJobService.APP_IPSTUDIO); }
                catch (BusinessException e) { log.warn("[director] 读取视频任务失败 job={} reason={}", entry.path("jobId").asText(), e.getMessage()); running[0] = true; continue; }
                String status = job.path("status").asText();
                if ("ready".equals(status)) {
                    // OSS 下任务卡带 video_key；本地存储只有地址，按画布同一个办法（keyOfStoredUrl）还原 key。
                    String key = job.path("video_key").asText(null);
                    if (key == null && job.path("video_url").isTextual()) key = storage.keyOfStoredUrl(job.path("video_url").asText());
                    pending.remove(i);
                    changed = true;
                    if (key == null) { slot.set("error", om.createObjectNode().put("message", "视频已生成，文件读取失败。请联系管理员处理，勿重复生成。").put("at", Instant.now().toString())); continue; }
                    addVideoCandidate(c, (ObjectNode) clipNode, key, null, entry.path("meta"), false);
                } else if ("failed".equals(status)) {
                    pending.remove(i);
                    changed = true;
                    slot.set("error", om.createObjectNode().put("message", job.path("error_message").asText("视频生成失败，冻结积分将退回，可重试")).put("at", Instant.now().toString()));
                    JsonNode p = c.path("pipeline");
                    if (p.isObject()) for (JsonNode vj : p.path("videoJobs")) if (vj.path("jobId").asText().equals(entry.path("jobId").asText())) {
                        ((ObjectNode) p).withArray("failed").add("video:" + clipNode.path("id").asText());
                        ((ObjectNode) vj).put("estimate", 0);
                    }
                } else {
                    running[0] = true;
                    String stage = job.path("stage").asText("生成中");
                    int pct = job.path("progress_pct").asInt(0);
                    if (!stage.equals(entry.path("stage").asText()) || pct != entry.path("pct").asInt()) { entry.put("stage", stage).put("pct", pct); changed = true; }
                }
            }
        }
        return changed;
    }

    private void addVideoCandidate(ObjectNode c, ObjectNode clip, String key, String runId, JsonNode meta, boolean mock) {
        ObjectNode slot = (ObjectNode) clip.path("video");
        // 换模板之前提交、之后才完成的任务没有 promptFormat：按旧模板核对，免得被当成「生成期间设置有变动」。
        Limits lim = limits(c);
        String legacy = meta.has("promptFormat") ? null : legacyVideoPrompt(c, clip, lim);
        String now = (legacy == null ? videoCurrent(c, clip, lim) : videoCurrent(c, clip, lim, legacy)).fingerprint();
        boolean stale = !meta.hasNonNull("fingerprint") || !meta.path("fingerprint").asText().equals(now);
        ObjectNode m = addCandidate(c, slot, key, runId, "generated");
        if (meta.hasNonNull("fingerprint")) m.put("fingerprint", meta.path("fingerprint").asText());
        if (meta.has("promptFormat")) m.put("promptFormat", meta.path("promptFormat").asInt());
        if (meta.has("sentPrompt")) m.put("sentPrompt", meta.path("sentPrompt").asText());
        if (meta.has("prompt")) m.put("prompt", meta.path("prompt").asText());
        if (meta.has("refs")) m.set("refs", meta.path("refs").deepCopy());
        if (mock) m.put("mock", true);
        if (stale) {
            m.put("stale", true);
            notice(c, "片段「" + clip.path("title").asText() + "」生成期间设置有变动，新视频已存入历史版本，未自动采用");
        } else if (adoptedKey(slot) == null) slot.put("adoptedId", m.path("id").asText()).put("adoptedBy", "auto");
    }

    // ── 整集导出 ─────────────────────────────────────────────────────────────

    private String export(String userId, DirectorWork w, ObjectNode c, String episodeId, String requestId) {
        ObjectNode ep = find(c, "episodes", episodeId, "这一集");
        List<JsonNode> clips = new ArrayList<>();
        for (JsonNode clip : c.path("clips")) if (episodeId.equals(clip.path("episodeId").asText())) clips.add(clip);
        clips.sort(Comparator.comparingInt(x -> x.path("order").asInt()));
        if (clips.isEmpty()) throw invalid("本集暂无片段");
        List<String> missing = new ArrayList<>(), unconfirmed = new ArrayList<>(), keys = new ArrayList<>();
        ArrayNode used = om.createArrayNode();
        for (JsonNode clip : clips) {
            String key = adoptedKey(clip.path("video"));
            String label = "片段 " + clip.path("order").asInt();
            if (key == null) { missing.add(label); continue; }
            if ("auto".equals(clip.path("video").path("adoptedBy").asText())) unconfirmed.add(label);
            keys.add(projects.requireOwnedAssetKey(userId, key));
            used.addObject().put("clipId", clip.path("id").asText()).put("candidateId", clip.path("video").path("adoptedId").asText());
        }
        if (!missing.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_EXPORT_INCOMPLETE",
                "缺少视频：" + String.join("、", missing) + "。整集导出需每个片段均有采用的视频");
        if (!unconfirmed.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_EXPORT_UNCONFIRMED",
                "待确认视频：" + String.join("、", unconfirmed) + "。确认后可导出");
        String node = "export:" + episodeId;
        requireIdle(w, node);
        ObjectNode input = om.createObjectNode().put("operation", "assemble").put("mock", fixtures.enabled())
                .put("aspectRatio", c.path("settings").path("aspectRatio").asText("9:16"));
        ArrayNode references = input.putArray("references");
        keys.forEach(k -> references.addObject().put("role", "clip").put("storageKey", k));
        String runId = newTx.execute(tx -> workflowRun(userId, w.getId(), node, requestId, "studio-assemble", input));
        ObjectNode entry = c.withArray("exports").addObject().put("id", runId).put("episodeId", episodeId).put("episodeNo", ep.path("no").asInt())
                .put("status", "running").put("createdAt", Instant.now().toString());
        entry.putNull("key"); entry.putNull("durationSec"); entry.putNull("error");
        entry.set("clips", used);
        track(c, null, runId, om.createObjectNode().put("node", node));
        w.setActive(true);
        return runId;
    }

    private void applyExport(ObjectNode c, IpRun run, JsonNode output) {
        for (JsonNode e : c.path("exports")) if (run.getId().equals(e.path("id").asText())) {
            ObjectNode entry = (ObjectNode) e;
            if (IpRun.STATUS_DONE.equals(run.getStatus()) && output.path("storageKey").isTextual()) {
                entry.put("status", "done").put("key", output.path("storageKey").asText()).put("durationSec", output.path("durationSec").asDouble());
            } else {
                entry.put("status", "failed").put("error", run.getErrorMessage() == null ? "合成失败，请重试" : run.getErrorMessage());
            }
        }
    }

    private void requireIdle(DirectorWork w, String nodeId) {
        if (runs.findByProjectIdAndNodeIdAndStatus(w.getId(), nodeId, IpRun.STATUS_RUNNING).stream()
                .anyMatch(r->!"studio-director".equals(r.getKind())||!r.isCancelRequested()))
            throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "该项生成中，请稍候");
    }

    private void track(ObjectNode c, ObjectNode pipeline, String runId, ObjectNode meta) {
        ((ObjectNode) c.path("taskMeta")).set(runId, meta);
        if (pipeline != null) pipeline.withArray("runIds").add(runId);
    }

    // ── 结果回投 ─────────────────────────────────────────────────────────────

    /** 把已结束、还没回投的任务结果写进作品。返回内容是否有变化。 */
    boolean reconcile(DirectorWork w, ObjectNode c) {
        Set<String> applied = new HashSet<>();
        c.path("applied").forEach(x -> applied.add(x.asText()));
        boolean changed = false, running = false;
        List<IpRun> mine = new ArrayList<>(runs.findByProjectIdOrderByCreatedAtDesc(w.getId()));
        Collections.reverse(mine);
        for (IpRun run : mine) {
            if (IpRun.STATUS_RUNNING.equals(run.getStatus())) { running = true; continue; }
            if (applied.contains(run.getId())) continue;
            try { apply(w, c, run); }
            catch (RuntimeException e) {
                log.warn("[director] 回投失败 work={} run={} reason={}", w.getId(), run.getId(), e.toString());
                setError(c, run.getNodeId(), "结果写入失败，请重新生成");
            }
            ((ArrayNode) c.path("applied")).add(run.getId());
            changed = true;
        }
        // 回投时接着发出的任务（改写重试、改写后的视频）不在上面读到的列表里：taskMeta 里有、列表里没有的就是刚发出的。
        // 不算上它，作品会被标成不活跃，关掉页面后后台不再推进，改写完成也没人接着提交视频。
        Set<String> listed = new HashSet<>();
        mine.forEach(r -> listed.add(r.getId()));
        for (Iterator<String> it = c.path("taskMeta").fieldNames(); it.hasNext(); ) if (!listed.contains(it.next())) running = true;
        boolean[] videoRunning = {false};
        if (pollVideos(w, c, videoRunning)) changed = true;
        running |= videoRunning[0];
        if (changed) refresh(c);
        JsonNode p = c.path("pipeline");
        boolean active = running || p.isObject() && "running".equals(p.path("status").asText());
        if (active != w.isActive()) { w.setActive(active); changed = true; }
        return changed;
    }

    private void apply(DirectorWork w, ObjectNode c, IpRun run) {
        String node = run.getNodeId();
        if (node.startsWith("export:")) { applyExport(c, run, parse(run.getOutputJson())); return; }
        if (node.startsWith("video:") && "video.bound".equals(run.getStage())) return; // 真实视频由 pollVideos 跟踪原生任务
        if (IpRun.STATUS_FAILED.equals(run.getStatus())) {
            if("studio-director".equals(run.getKind())&&"IP_RUN_CANCELLED".equals(run.getErrorCode())){notice(c,run.getErrorMessage());return;}
            if (node.startsWith(REWRITE_NODE) && (retryRewrite(w, c, run) || originalInPipeline(w, c, run))) return;
            setError(c, node, run.getErrorMessage() == null ? "生成失败，请重试" : run.getErrorMessage());
            JsonNode p = c.path("pipeline");
            if (p.isObject() && contains(p.path("runIds"), run.getId())) ((ObjectNode) p).withArray("failed").add(node);
            return;
        }
        JsonNode output = parse(run.getOutputJson());
        JsonNode meta = c.path("taskMeta").path(run.getId());
        if (node.startsWith("video:")) {
            JsonNode clip = findOrNull(c, "clips", node.substring(6));
            if (clip != null && output.path("storageKey").isTextual())
                addVideoCandidate(c, (ObjectNode) clip, output.path("storageKey").asText(), run.getId(), meta, output.path("mock").asBoolean(false));
            return;
        }
        if (node.startsWith("asset:") || node.startsWith("board:")) {
            boolean asset = node.startsWith("asset:");
            ObjectNode target = (ObjectNode) findOrNull(c, asset ? "assets" : "clips", node.substring(node.indexOf(':') + 1));
            if (target == null) return;
            refresh(c);
            // 输入指纹：生成期间改了提示词、换了参考图，旧结果只进历史，不自动采用。
            String now = asset ? assetFingerprint(target) : boardFingerprintOrNull(c, target);
            boolean stale = !meta.hasNonNull("fingerprint") || !meta.path("fingerprint").asText().equals(now);
            ObjectNode slot = (ObjectNode) target.path(asset ? "image" : "board");
            for (JsonNode cand : output.path("candidates")) {
                String key = cand.path("key").asText(null);
                if (key == null) continue;
                ObjectNode m = addCandidate(c, slot, key, run.getId(), "generated");
                if (meta.hasNonNull("fingerprint")) m.put("fingerprint", meta.path("fingerprint").asText());
                if (meta.has("prompt")) m.put("prompt", meta.path("prompt").asText());
                if (meta.has("refs")) m.set("refs", meta.path("refs").deepCopy());
                if (output.path("mock").asBoolean(false)) m.put("mock", true);
                if (stale) m.put("stale", true);
                else if (adoptedKey(slot) == null) slot.put("adoptedId", m.path("id").asText()).put("adoptedBy", "auto");
            }
            if (stale) notice(c, "「" + target.path(asset ? "name" : "title").asText() + "」生成期间设置有变动，新图已存入历史版本，未自动采用");
            return;
        }
        JsonNode d = output.path("director");
        JsonNode in = parse(run.getInputJson()).path("_director");
        switch (in.path("task").asText()) {
            case "videoPrompt" -> {
                ObjectNode clip = (ObjectNode) findOrNull(c, "clips", in.path("targetId").asText());
                if (clip == null || !d.path("template").isTextual()) return;
                ObjectNode en = clip.putObject("videoPromptEn").put("hash", in.path("hash").asText()).put("template", d.path("template").asText())
                        .put("usable", d.path("usable").asBoolean(true)).put("runId", run.getId()).put("at", Instant.now().toString());
                en.set("warnings", d.path("warnings").isArray() ? d.path("warnings").deepCopy() : om.createArrayNode());
                en.set("notes", d.path("notes").isArray() ? d.path("notes").deepCopy() : om.createArrayNode());
                chainVideo(w, c, clip, in.path("then"));
            }
            case "script" -> {
                if (in.path("regenerate").asBoolean(false)) {
                    // 重新生成：提交后剧本、分集、片段都没动过才替换；旧剧本进历史（最近 3 版），资产保留、解除与旧分集的关联。
                    boolean media = false;
                    for (JsonNode clip : c.path("clips")) if (hasMedia(clip)) media = true;
                    if (media || !scriptBaseHash(c).equals(in.path("baseHash").asText())) {
                        notice(c, "生成期间剧本或片段有修改，新剧本未替换当前内容"); return;
                    }
                    ArrayNode history = c.withArray("scriptHistory");
                    StringBuilder old = new StringBuilder(c.path("draft").asText());
                    for (JsonNode ep : c.path("episodes")) { if (old.length() > 0) old.append("\n\n"); old.append(ep.path("content").asText()); }
                    history.insert(0, om.createObjectNode().put("title", w.getTitle()).put("at", Instant.now().toString()).put("logline", c.path("logline").asText()).put("draft", old.toString())
                            .set("outline", c.path("outline").isObject() ? c.path("outline") : om.nullNode()));
                    while (history.size() > 3) history.remove(history.size() - 1);
                    c.putArray("episodes"); c.putArray("clips"); c.putNull("pendingExtract"); c.putNull("pendingSplit"); c.putNull("splitUndo");
                    for (JsonNode a : c.path("assets")) ((ObjectNode) a).putArray("episodeIds");
                    c.put("draft", d.path("content").asText()).put("draftRev", c.path("draftRev").asLong() + 1);
                    if (!d.path("title").asText().isBlank()) w.setTitle(limited(d.path("title").asText(), 60, "作品名"));
                    if (!d.path("logline").asText().isBlank()) c.put("logline", d.path("logline").asText());
                    if (d.path("outline").isObject()) c.set("outline", d.path("outline")); else c.putNull("outline");
                    notice(c, "剧本已重新生成，旧版本保留在历史中；资产保留，请重新拆分并提取资产");
                    return;
                }
                if (!c.path("draft").asText().isBlank() || c.path("episodes").size() > 0 || c.path("draftRev").asLong() != in.path("draftRev").asLong()) {
                    notice(c, "生成期间剧本已有内容，新生成的剧本未覆盖"); return;
                }
                c.put("draft", d.path("content").asText()).put("draftRev", c.path("draftRev").asLong() + 1);
                if (!d.path("title").asText().isBlank()) w.setTitle(limited(d.path("title").asText(), 60, "作品名"));
                if (!d.path("logline").asText().isBlank()) c.put("logline", d.path("logline").asText());
                if (d.path("outline").isObject()) c.set("outline", d.path("outline"));
            }
            case "split" -> {
                String draft = c.path("draft").asText();
                if (c.path("episodes").size() > 0 || c.path("pendingSplit").isObject() || !hash(draft).equals(in.path("draftHash").asText())) {
                    notice(c, "拆分期间剧本有修改，本次结果未使用，请重新拆分"); return;
                }
                // 校验已把起点构造成首尾相接的区间；这里把程序做过的修正写成用户看得懂的话，结果先给用户确认。
                List<String> ps = paragraphs(draft);
                List<SplitRange> ranges = new ArrayList<>();
                List<String> notes = new ArrayList<>(), warnings = new ArrayList<>();
                JsonNode eps = d.path("episodes");
                int headFrom = d.path("headFrom").asInt(), bodyStart = d.path("bodyStart").asInt();
                if (headFrom > bodyStart) notes.add("第 1 集开头补入 " + (headFrom - bodyStart) + " 段（从「" + snippet(ps.get(bodyStart)) + "」开始）");
                for (int i = 0; i < eps.size(); i++) {
                    JsonNode e = eps.get(i);
                    int start = e.path("startParagraph").asInt(), end = e.path("endParagraph").asInt(), modelEnd = e.path("modelEnd").asInt(-1);
                    ranges.add(new SplitRange(e.path("title").asText(), e.path("summary").asText(), start, end));
                    if (modelEnd >= start && modelEnd < end)
                        notes.add("第 " + (i + 1) + " 集结尾补入 " + (end - modelEnd) + " 段（从「" + snippet(ps.get(modelEnd + 1)) + "」开始）");
                    else if (modelEnd > end && i + 1 < eps.size())
                        notes.add("第 " + (i + 1) + " 集和第 " + (i + 2) + " 集的范围有重叠，按第 " + (i + 2) + " 集的开头分开");
                }
                if (d.path("dropped").asInt() > 0) notes.add("有 " + d.path("dropped").asInt() + " 个分集位置超出了剧本范围，已忽略");
                if (d.path("duplicates").asInt() > 0) notes.add("有 " + d.path("duplicates").asInt() + " 个重复的分集位置，已合并");
                int target = in.path("targetEpisodeCount").asInt(0);
                if (target > 0 && target != ranges.size()) warnings.add("你要求分成 " + target + " 集，这次分成了 " + ranges.size() + " 集。不合适可以放弃后重新拆分");
                c.set("pendingSplit", pendingSplit(c, run.getId(), "model", ps, ranges, notes, warnings));
            }
            case "extract" -> {
                // 提取结果先放进待确认清单：用户在弹窗里勾选、改名后才写进作品的资产，这里不改任何资产。
                ArrayNode items = om.createArrayNode();
                for (JsonNode a : d.path("assets")) {
                    // 编号不能叫 key：出 wire 时名叫 key 的字段会被当成素材地址去签名。
                    ObjectNode it = items.addObject().put("itemId", "x" + items.size()).put("kind", a.path("kind").asText())
                            .put("name", a.path("name").asText()).put("description", a.path("description").asText());
                    it.set("aliases", a.path("aliases").isArray() ? a.path("aliases").deepCopy() : om.createArrayNode());
                    it.set("episodeNos", a.path("episodeNos").isArray() ? a.path("episodeNos").deepCopy() : om.createArrayNode());
                    JsonNode match = matchAsset(c, a.path("existingId").asText(null), a.path("kind").asText(), a.path("name").asText());
                    if (match == null) it.putNull("matchId"); else it.put("matchId", match.path("id").asText()).put("matchName", match.path("name").asText());
                }
                if (items.isEmpty()) { markExtracted(c, in.path("episodes")); notice(c, "未发现新的角色、场景或道具"); return; }
                ObjectNode pending = c.putObject("pendingExtract").put("runId", run.getId()).put("at", Instant.now().toString());
                pending.set("items", items);
                pending.set("episodes", in.path("episodes").deepCopy());
            }
            case "plan" -> {
                String epId = in.path("episodeId").asText();
                ObjectNode ep = (ObjectNode) findOrNull(c, "episodes", epId);
                if (ep == null) return;
                if (!hash(ep.path("content").asText()).equals(in.path("contentHash").asText())) {
                    notice(c, "写分镜脚本期间第 " + ep.path("no").asInt() + " 集正文有修改，这次结果没有用上，请重写分镜脚本"); return;
                }
                // 规划期间用户改过本集片段（提示词、镜头、增删）：保留原片段，新计划留着让用户决定要不要换。
                boolean touched = !clipsHash(c, epId).equals(in.path("clipsHash").asText());
                boolean media = false;
                for (JsonNode clip : c.path("clips")) if (epId.equals(clip.path("episodeId").asText()) && hasMedia(clip)) media = true;
                if (touched || media) {
                    ObjectNode pending = ep.putObject("pendingPlan").put("runId", run.getId()).put("at", Instant.now().toString());
                    pending.set("clips", d.path("clips").deepCopy());
                    notice(c, "第 " + ep.path("no").asInt() + " 集片段在写分镜脚本期间有修改，新写的版本没有覆盖。可在「分镜」中选择换成新版本");
                    return;
                }
                replaceClips(c, ep, d.path("clips"));
            }
            default -> { }
        }
    }

    private void replaceClips(ObjectNode c, ObjectNode ep, JsonNode planned) {
        String epId = ep.path("id").asText();
        for (JsonNode clip : c.path("clips")) if (epId.equals(clip.path("episodeId").asText()) && hasMedia(clip))
            throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_CLIPS_HAVE_MEDIA", "本集片段已有分镜图或视频，请先删除不需要的片段再替换");
        ArrayNode clips = (ArrayNode) c.path("clips");
        for (int i = clips.size() - 1; i >= 0; i--) if (epId.equals(clips.get(i).path("episodeId").asText())) clips.remove(i);
        for (JsonNode p : planned) {
            ObjectNode clip = newClip(c, epId, p.path("title").asText(), p.path("summary").asText());
            clip.set("assetIds", p.path("assetIds").deepCopy());
            setShots(c, clip, p.path("shots"), false);
            clips.add(clip);
        }
        renumber(c, epId);
        ep.put("planStale", false);
        ep.putNull("pendingPlan");
    }

    // ── 报价与上传 ───────────────────────────────────────────────────────────

    public record QuoteRequest(String type, List<String> targetIds) {}

    /** 片段视频报价：逐个片段给价格，或者说明为什么现在还不能生成。不建任务、不扣积分。 */
    @Transactional(readOnly = true)
    public JsonNode quote(String userId, String id, QuoteRequest req) {
        DirectorWork w = owned(userId, id);
        ObjectNode c = read(w);
        refresh(c);
        if (!"video".equals(req.type())) throw invalid("仅支持片段视频报价");
        ArrayNode items = om.createArrayNode();
        for (String clipId : req.targetIds() == null ? List.<String>of() : req.targetIds()) {
            ObjectNode item = items.addObject().put("targetId", clipId);
            JsonNode clip = findOrNull(c, "clips", clipId);
            if (clip == null) { item.putNull("credits").put("error", "片段不存在，请刷新"); continue; }
            try { item.put("credits", videoQuote(userId, c, clip)).putNull("error"); }
            catch (BusinessException e) { item.putNull("credits").put("error", e.getMessage()); }
        }
        ObjectNode out = om.createObjectNode();
        out.set("items", items);
        return out;
    }

    /** 角色声音样本上传：沿用 Studio 媒体导入的格式与时长校验（字节嗅探、ffprobe）。 */
    @Transactional(readOnly = true)
    public StudioMediaImportService.MediaImportResult uploadAudio(String userId, String id, org.springframework.web.multipart.MultipartFile file) {
        owned(userId, id);
        return mediaImport.upload(userId, file, "audio");
    }

    // ── 一键连跑 ─────────────────────────────────────────────────────────────

    /** auto=true：全自动，资产清单、参考图、分镜图、片段视频都不停下来等确认（预算仍是硬上限）。 */
    public record PipelineRequest(String action, String scope, String episodeId, String target, Long budget, BillingSelection billing, Boolean auto) {}

    @Transactional
    public JsonNode pipeline(String userId, String id, PipelineRequest req) {
        DirectorWork w = locked(userId, id);
        ObjectNode c = read(w);
        reconcile(w, c);
        JsonNode current = c.path("pipeline");
        switch (req.action() == null ? "" : req.action()) {
            case "start" -> {
                if (current.isObject() && Set.of("running", "waiting", "paused").contains(current.path("status").asText()))
                    throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_PIPELINE_RUNNING", "一键制作进行中");
                String target = req.target() == null ? "film" : req.target();
                if (!Set.of("plan", "board", "video", "film").contains(target)) throw invalid("一键制作仅支持到分镜脚本、分镜图、片段视频或成片");
                String scope = "work".equals(req.scope()) ? "work" : "episode";
                if ("episode".equals(scope) && req.episodeId() != null) find(c, "episodes", req.episodeId(), "这一集");
                if (req.budget() == null || req.budget() <= 0) throw invalid("请设置预算上限");
                ObjectNode p = om.createObjectNode().put("id", "PL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                        .put("scope", scope).put("target", target).put("status", "running").put("stage", "starting")
                        .put("message", "启动中").put("budget", req.budget()).put("spent", 0).put("startedAt", Instant.now().toString())
                        .put("auto", Boolean.TRUE.equals(req.auto()));
                if ("episode".equals(scope) && req.episodeId() != null) p.put("episodeId", req.episodeId()); else p.putNull("episodeId");
                // 付款方在启动时定下来，整个连跑都用这一个（§10.2a）。
                if (req.billing() != null) p.set("billing", om.valueToTree(req.billing())); else p.putNull("billing");
                p.putArray("runIds"); p.putArray("failed");
                c.set("pipeline", p);
                advance(userId, w, c);
            }
            case "pause" -> requirePipeline(current).put("status", "paused").put("message", "已暂停：不再开始新任务，进行中的任务继续完成");
            case "resume", "retry" -> {
                ObjectNode p = requirePipeline(current);
                if (req.budget() != null && req.budget() > 0) p.put("budget", req.budget());
                if ("retry".equals(req.action())) p.putArray("failed");
                p.put("status", "running").put("message", "继续制作");
                advance(userId, w, c);
            }
            case "confirm-assets" -> {
                ObjectNode p = requirePipeline(current);
                for (String assetId : neededAssets(c, p)) {
                    JsonNode a = findOrNull(c, "assets", assetId);
                    if (a != null && "auto".equals(a.path("image").path("adoptedBy").asText())) ((ObjectNode) a.path("image")).put("adoptedBy", "user");
                }
                p.put("status", "running").put("message", "参考图已确认，继续制作分镜图");
                advance(userId, w, c);
            }
            case "confirm-boards" -> {
                ObjectNode p = requirePipeline(current);
                for (JsonNode clip : clipsOf(c, scopeEpisodes(c, p))) {
                    ObjectNode slot = (ObjectNode) clip.path("board");
                    if ("auto".equals(slot.path("adoptedBy").asText())) slot.put("adoptedBy", "user");
                }
                p.put("status", "running").put("message", "分镜图已确认，继续生成片段视频");
                advance(userId, w, c);
            }
            case "confirm-videos" -> {
                ObjectNode p = requirePipeline(current);
                confirmVideos(c, p);
                p.put("status", "running").put("message", "片段视频已确认，继续导出成片");
                advance(userId, w, c);
            }
            case "stop" -> requirePipeline(current).put("status", "stopped").put("message", "已停止，进行中的任务继续完成").put("finishedAt", Instant.now().toString());
            case "dismiss" -> c.putNull("pipeline");
            default -> throw invalid("不支持的操作");
        }
        reconcile(w, c);
        save(w, c);
        return view(userId, w, c);
    }

    public record EstimateRequest(String scope, String episodeId, String target) {}

    /**
     * 一键制作的推荐预算：按作品现状数还要做几次文字、几张图、多少秒视频，用和真正提交同一套单价算出来，
     * 再留 15% 余量。还没规划的部分按默认篇幅估（没分集按 3 集、每集约 75 秒），结果里标明是估算。不建任务、不扣积分。
     */
    @Transactional(readOnly = true)
    public JsonNode estimate(String userId, String id, EstimateRequest req) {
        DirectorWork w = owned(userId, id);
        ObjectNode c = read(w);
        refresh(c);
        String target = req.target() == null ? "film" : req.target();
        boolean work = "work".equals(req.scope());
        long[] prices = directorPrices(c);
        Limits lim = limits(c);
        List<JsonNode> eps = new ArrayList<>();
        for (JsonNode ep : c.path("episodes")) if (work || req.episodeId() == null || req.episodeId().equals(ep.path("id").asText())) eps.add(ep);
        if (!work && req.episodeId() == null && eps.size() > 1) eps = List.of(eps.get(0));
        int text = 0, images = 0, clipsTotal = 0, seconds = 0, plannedVideos = 0;
        long textCredits = 0, videoCredits = 0;
        boolean rough = false;
        String videoError = null;
        boolean toVideo = Set.of("video", "film").contains(target);
        int perClip = lim == null ? 0 : lim.max();
        int estClipsPerEp = lim == null ? 0 : Math.max(1, (int) Math.ceil(75.0 / Math.max(1, lim.max())));
        if (c.path("episodes").isEmpty()) {
            rough = true;
            if (c.path("draft").asText().isBlank()) { text++; textCredits += directorTextPrice(c, prices[0]); }
            int n = work ? 3 : 1;
            // 拆分（剧本里标好分集就不调模型）+ 提取 + 每集写分镜脚本
            if (DirectorPrompts.headingStarts(paragraphs(c.path("draft").asText())).isEmpty()) { text++; textCredits += directorTextPrice(c, prices[0]); }
            text++; textCredits += directorTextPrice(c, prices[0]);
            text += n; textCredits += (long) n * directorTextPrice(c, prices[0]);
            images += 6;                                      // 角色、场景、道具参考图
            clipsTotal = n * estClipsPerEp;
            images += clipsTotal;                             // 分镜图
        } else {
            if (eps.stream().anyMatch(e -> !e.path("extracted").asBoolean(false))) { text++; textCredits += directorTextPrice(c, prices[0]); }
            Set<String> epIds = new HashSet<>();
            eps.forEach(e -> epIds.add(e.path("id").asText()));
            boolean assetsKnown = c.path("assets").size() > 0;
            if (!assetsKnown) { rough = true; images += 6; }
            else for (JsonNode a : c.path("assets")) {
                boolean inScope = work || a.path("episodeIds").isEmpty();
                for (JsonNode e : a.path("episodeIds")) if (epIds.contains(e.asText())) inScope = true;
                if (inScope && !audioOnly(a) && a.path("image").path("candidates").isEmpty()) images++;
            }
            for (JsonNode ep : eps) {
                List<JsonNode> clips = clipsOf(c, List.of(ep));
                if (clips.isEmpty()) { rough = true; text++; textCredits += directorTextPrice(c, prices[0]); clipsTotal += estClipsPerEp; images += estClipsPerEp; continue; }
                for (JsonNode clip : clips) {
                    if (clip.path("board").path("candidates").isEmpty()) images++;
                    if (!toVideo || clip.path("video").path("candidates").size() > 0) continue;
                    int sec = (int) Math.round(clip.path("durationSec").asDouble());
                    seconds += sec;
                    plannedVideos++;
                    try {
                        try { videoCredits += videoQuote(userId, c, clip); }
                        catch (BusinessException notReady) { videoCredits += estimateVideo(lim, sec, 1 + clip.path("assetIds").size()); }
                    } catch (BusinessException e) { videoError = e.getMessage(); }
                }
            }
        }
        if (toVideo && clipsTotal > 0) {
            seconds += clipsTotal * perClip;
            try { videoCredits += (long) clipsTotal * estimateVideo(lim, perClip, 4); }
            catch (BusinessException e) { videoError = e.getMessage(); }
        }
        if (toVideo && lim == null) videoError = "暂无可用视频模型，无法估算视频费用";
        if ("plan".equals(target)) images = 0;
        long imageCredits = (long) images * prices[1];
        long total = textCredits + imageCredits + (toVideo ? videoCredits : 0);
        long recommended = Math.max(10, (long) Math.ceil(total * 1.15 / 10.0) * 10);
        ObjectNode out = om.createObjectNode().put("target", target).put("rough", rough).put("total", total).put("recommended", recommended);
        out.putObject("text").put("count", text).put("credits", textCredits);
        out.putObject("images").put("count", images).put("credits", imageCredits);
        ObjectNode v = out.putObject("videos").put("included", toVideo).put("clips", toVideo ? clipsTotal + plannedVideos : 0)
                .put("seconds", toVideo ? seconds : 0).put("credits", toVideo ? videoCredits : 0);
        if (videoError != null && toVideo) v.put("error", videoError); else v.putNull("error");
        return out;
    }

    /** 还没有分镜图时的视频估价：同一张价表，按时长和参考图张数算。 */
    private long estimateVideo(Limits lim, int seconds, int refImages) {
        if (lim == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DIRECTOR_VIDEO_MODEL_UNAVAILABLE", "暂无可用视频模型");
        if (fixtures.enabled()) return 0;
        if (lim.frame()) return videoJobs.studioLegacyQuote(lim.model(), seconds);
        return videoModels.estimate(lim.model(), VIDEO_MODE, lim.tier(), seconds, refImages);
    }

    /** 后台调度：回投结果并推进连跑。每个作品在自己的事务里、持行锁执行。 */
    @Transactional
    public void tick(String id) {
        DirectorWork w = works.lockById(id).orElse(null);
        if (w == null || w.getDeletedAt() != null) return;
        ObjectNode c = read(w);
        boolean changed = reconcile(w, c);
        JsonNode p = c.path("pipeline");
        if (p.isObject() && "running".equals(p.path("status").asText())) {
            String before = c.toString();
            advance(w.getOwnerUserId(), w, c);
            reconcile(w, c);
            changed |= !before.equals(c.toString());
        }
        if (changed) save(w, c); else works.save(w);
    }

    private void advance(String userId, DirectorWork w, ObjectNode c) {
        ObjectNode p = (ObjectNode) c.path("pipeline");
        if (!"running".equals(p.path("status").asText())) return;
        refresh(c);
        Set<String> failed = ids(p.path("failed"));
        long spent = pipelineSpent(p);
        int inflight = 0;
        Set<String> busy = new HashSet<>();
        for (JsonNode r : p.path("runIds")) {
            IpRun run = runs.findById(r.asText()).orElse(null);
            if (run == null || !IpRun.STATUS_RUNNING.equals(run.getStatus())) continue;
            inflight++; busy.add(run.getNodeId());
            if (run.getNodeId().startsWith(REWRITE_NODE)) busy.add("video:" + run.getNodeId().substring(REWRITE_NODE.length()));
        }
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            for (JsonNode vj : p.path("videoJobs")) if (vj.path("jobId").asText().equals(pend.path("jobId").asText())) {
                inflight++; busy.add("video:" + clip.path("id").asText());
            }
        p.put("spent", spent);
        BillingSelection billing = p.hasNonNull("billing") ? om.convertValue(p.path("billing"), BillingSelection.class) : null;
        Step step = new Step(userId, w, c, p, spent, inflight, busy, directorPrices(c), billing);
        try {
            // 1. 剧本与分集
            if (c.path("episodes").isEmpty()) {
                if (c.path("draft").asText().isBlank()) {
                    if (c.path("idea").asText().isBlank()) { finish(p, "failed", "请先填写创意或导入剧本"); return; }
                    if (failed.contains("script")) { finish(p, "failed", "剧本生成失败，请在「剧本」中重试"); return; }
                    step.send("script", null, "剧本生成中"); return;
                }
                // 分集结果：全自动就按默认（开头资料保留为设定资料）直接采用并说明做了什么，否则停下等确认。
                JsonNode pendingSplit = c.path("pendingSplit");
                if (pendingSplit.isObject()) {
                    if (!auto(p)) { p.put("status", "waiting").put("stage", "confirm-split").put("message", "分集已拆好，请确认后继续"); return; }
                    int n = applySplit(c, pendingSplit, false);
                    notice(c, splitNotice(n, pendingSplit));
                    p.put("stage", "split").put("message", "已分成 " + n + " 集，继续制作");
                    return;
                }
                if (failed.contains("split")) {
                    if (!auto(p)) { finish(p, "failed", "拆分失败，请在「剧本」中重试或作为一集"); return; }
                    // 全自动不因拆分失败停下：原文完整地作为一集继续，之后可以撤销重新拆分。
                    asOneEpisode(w, c);
                    notice(c, "没能自动拆分，已作为一集继续；可以在「剧本」中撤销拆分后重新拆分");
                    p.put("stage", "split").put("message", "已作为一集，继续制作");
                    return;
                }
                if (splitByHeadings(c, 0)) { p.put("stage", "split").put("message", "已按剧本里的分集标题拆好"); return; }
                step.send("split", null, "拆分集中"); return;
            }
            List<JsonNode> eps = scopeEpisodes(c, p);
            // 2. 资产提取
            List<JsonNode> notExtracted = eps.stream().filter(e -> !e.path("extracted").asBoolean(false)).toList();
            if (c.path("pendingExtract").isObject()) {
                if (auto(p)) {
                    // 全自动：清单原样全部入库（同名合并、对上已有资产照旧合并），下一轮接着做。
                    JsonNode pending = c.path("pendingExtract");
                    ArrayNode picks = om.createArrayNode();
                    for (JsonNode it : pending.path("items")) picks.addObject().put("itemId", it.path("itemId").asText());
                    int added = saveExtracted(c, pending, picks);
                    markExtracted(c, pending.path("episodes"));
                    c.putNull("pendingExtract");
                    refresh(c);
                    p.put("stage", "assets").put("message", "资产已自动保存（新增 " + added + " 项），继续制作");
                    return;
                }
                p.put("status", "waiting").put("stage", "confirm-extract").put("message", "资产已识别，请确认后保存");
                return;
            }
            if (!notExtracted.isEmpty()) {
                String target = notExtracted.size() == eps.size() && "work".equals(p.path("scope").asText()) ? null : notExtracted.get(0).path("id").asText();
                if (failed.contains(target == null ? "extract" : "extract:" + target)) { finish(p, "failed", "资产提取失败，请在「资产」中重试"); return; }
                step.send("extract", target, "资产提取中"); return;
            }
            // 3. 片段规划
            boolean planning = false;
            for (JsonNode ep : eps) {
                if (hasClips(c, ep.path("id").asText()) || ep.path("pendingPlan").isObject() || failed.contains("plan:" + ep.path("id").asText())) continue;
                planning = true;
                if (!step.send("plan", ep.path("id").asText(), "正在写分镜脚本")) return;
            }
            if (planning) return;
            // 只做到分镜脚本：分集、资产和每段的镜头、分镜图提示词、视频提示词都有了就停，不出图。
            if ("plan".equals(p.path("target").asText())) {
                List<String> planFailed = new ArrayList<>();
                for (JsonNode ep : eps) if (!hasClips(c, ep.path("id").asText()) && failed.contains("plan:" + ep.path("id").asText()))
                    planFailed.add("第 " + ep.path("no").asInt() + " 集");
                if (!planFailed.isEmpty()) {
                    p.put("status", "waiting").put("stage", "failed-items").put("message",
                            String.join("、", planFailed) + "分镜脚本没写成。可点「重试失败项」，或在「分镜」中单独写");
                    return;
                }
                int planned = clipsOf(c, eps).size();
                finish(p, "done", "分镜脚本已完成：" + eps.size() + " 集 " + planned + " 个片段，镜头和提示词在「分镜」中");
                return;
            }
            // 4. 参考图
            Set<String> needed = neededAssets(c, p);
            boolean imaging = false;
            for (String assetId : needed) {
                JsonNode a = findOrNull(c, "assets", assetId);
                if (a == null || audioOnly(a) || a.path("image").path("candidates").size() > 0 || failed.contains("asset:" + assetId)) continue;
                imaging = true;
                if (!step.send("asset-image", assetId, "参考图生成中")) return;
            }
            if (imaging) return;
            List<String> toConfirm = new ArrayList<>();
            for (String assetId : needed) {
                JsonNode a = findOrNull(c, "assets", assetId);
                if (a != null && "auto".equals(a.path("image").path("adoptedBy").asText())) toConfirm.add(a.path("name").asText());
            }
            if (!toConfirm.isEmpty() && auto(p)) {
                for (String assetId : needed) {
                    JsonNode a = findOrNull(c, "assets", assetId);
                    if (a != null && "auto".equals(a.path("image").path("adoptedBy").asText())) ((ObjectNode) a.path("image")).put("adoptedBy", "user");
                }
                refresh(c);
                toConfirm.clear();
            }
            if (!toConfirm.isEmpty()) {
                p.put("status", "waiting").put("stage", "confirm-assets")
                        .put("message", "参考图已生成（" + toConfirm.size() + " 张），请在「资产」中确认后继续");
                return;
            }
            // 5. 分镜图
            boolean boarding = false;
            List<String> blocked = new ArrayList<>();
            for (JsonNode clip : clipsOf(c, eps)) {
                if (clip.path("board").path("candidates").size() > 0) continue;
                String cid = clip.path("id").asText();
                if (failed.contains("board:" + cid)) continue;
                if (clip.path("issues").size() > 0) { blocked.add("片段 " + clip.path("order").asInt() + " 需修改"); continue; }
                try { boundRefs(c, clip, true); } catch (BusinessException e) { blocked.add("片段 " + clip.path("order").asInt() + "：" + e.getMessage()); continue; }
                boarding = true;
                if (!step.send("board", cid, "分镜图生成中")) return;
            }
            if (boarding) return;
            List<String> pendingPlans = new ArrayList<>();
            for (JsonNode ep : eps) if (ep.path("pendingPlan").isObject()) pendingPlans.add("第 " + ep.path("no").asInt() + " 集有新计划待替换");
            if (!blocked.isEmpty() || !pendingPlans.isEmpty()) {
                List<String> all = new ArrayList<>(pendingPlans);
                all.addAll(blocked);
                p.put("status", "waiting").put("stage", "fix-clips")
                        .put("message", "部分片段无法生成分镜图：" + String.join("；", all.subList(0, Math.min(3, all.size())))
                                + (all.size() > 3 ? " 等 " + all.size() + " 项" : "") + "。请在「分镜」中修改后继续");
                return;
            }
            boolean toVideo = Set.of("video", "film").contains(p.path("target").asText());
            if (toVideo) {
                List<String> boardsToConfirm = new ArrayList<>();
                for (JsonNode clip : clipsOf(c, eps)) if ("auto".equals(clip.path("board").path("adoptedBy").asText())) boardsToConfirm.add("片段 " + clip.path("order").asInt());
                if (!boardsToConfirm.isEmpty() && auto(p)) {
                    for (JsonNode clip : clipsOf(c, eps)) if ("auto".equals(clip.path("board").path("adoptedBy").asText())) ((ObjectNode) clip.path("board")).put("adoptedBy", "user");
                    refresh(c);
                    boardsToConfirm.clear();
                }
                if (!boardsToConfirm.isEmpty()) {
                    p.put("status", "waiting").put("stage", "confirm-boards")
                            .put("message", "分镜图已生成（" + boardsToConfirm.size() + " 张），请在「分镜」中确认后继续");
                    return;
                }
                boolean videoing = false;
                for (JsonNode clip : clipsOf(c, eps)) {
                    String cid = clip.path("id").asText();
                    if (clip.path("video").path("pending").size() > 0) { videoing = true; continue; }
                    if (clip.path("video").path("candidates").size() > 0 || failed.contains("video:" + cid) || failed.contains(REWRITE_NODE + cid) || adoptedKey(clip.path("board")) == null) continue;
                    videoing = true;
                    if (!step.send("video", cid, "片段视频生成中")) return;
                }
                if (videoing) return;
            }
            // 成片：每集的片段视频都有了 → 确认（全自动时直接确认）→ 导出整集（不扣积分）。
            if ("film".equals(p.path("target").asText()) && failed.isEmpty()) {
                List<String> missingVideo = new ArrayList<>();
                for (JsonNode clip : clipsOf(c, eps)) if (adoptedKey(clip.path("video")) == null) missingVideo.add("片段 " + clip.path("order").asInt());
                if (missingVideo.isEmpty()) {
                    boolean unconfirmed = false;
                    for (JsonNode clip : clipsOf(c, eps)) if ("auto".equals(clip.path("video").path("adoptedBy").asText())) unconfirmed = true;
                    if (unconfirmed && auto(p)) { confirmVideos(c, p); unconfirmed = false; }
                    if (unconfirmed) {
                        p.put("status", "waiting").put("stage", "confirm-videos").put("message", "片段视频已生成，请在「分镜」中确认后导出成片");
                        return;
                    }
                    int done = 0;
                    List<String> exportFailed = new ArrayList<>();
                    for (JsonNode ep : eps) {
                        String state = exportState(c, ep);
                        if ("done".equals(state)) { done++; continue; }
                        if ("running".equals(state)) { p.put("stage", "export").put("message", "成片导出中"); continue; }
                        if ("failed".equals(state) && failed.contains("export:" + ep.path("id").asText())) { exportFailed.add("第 " + ep.path("no").asInt() + " 集"); continue; }
                        if ("failed".equals(state)) ((ArrayNode) p.withArray("failed")).add("export:" + ep.path("id").asText());
                        step.send("export", ep.path("id").asText(), "成片导出中");
                    }
                    if (!exportFailed.isEmpty()) {
                        p.put("status", "waiting").put("stage", "failed-items").put("message", String.join("、", exportFailed) + "成片导出失败。可点「重试失败项」");
                        return;
                    }
                    if (done == eps.size()) { finish(p, "done", eps.size() + " 集成片已导出，可在「分镜」中预览和下载"); return; }
                    return;
                }
                p.put("status", "waiting").put("stage", "blocked").put("message", "这些片段还没有视频：" + String.join("、", missingVideo.subList(0, Math.min(3, missingVideo.size())))
                        + (missingVideo.size() > 3 ? " 等 " + missingVideo.size() + " 个" : "") + "。请在「分镜」中处理后点「继续」");
                return;
            }
            int boards = 0, videos = 0;
            for (JsonNode clip : clipsOf(c, eps)) {
                if (clip.path("board").path("candidates").size() > 0) boards++;
                if (clip.path("video").path("candidates").size() > 0) videos++;
            }
            if (toVideo && failed.isEmpty()) {
                finish(p, "done", videos + " 个片段视频已生成，请在「分镜」中确认，之后可连播预览或导出整集");
                return;
            }
            if (!failed.isEmpty()) {
                p.put("status", "waiting").put("stage", "failed-items").put("message",
                        boards + " 个片段有分镜图，" + failed.size() + " 项失败。可点「重试失败项」，或在对应位置单独重做");
                return;
            }
            finish(p, "done", boards + " 个片段的分镜图已生成，请在「分镜」中确认");
        } catch (BusinessException e) {
            p.put("status", "waiting").put("stage", "blocked").put("message", e.getMessage());
        }
    }

    /**
     * 一键制作已用的积分（含在途占用）：文字 / 出图任务的花费、在跑改写之后要提交的视频报价、已提交视频的报价。
     * 改写的那份视频预算从发出改写起就算占用，免得改写期间又发出别的视频、合起来超预算。
     */
    private long pipelineSpent(JsonNode p) {
        long spent = 0;
        for (JsonNode r : p.path("runIds")) {
            IpRun run = runs.findById(r.asText()).orElse(null);
            if (run == null) continue;
            spent += run.getCost();
            if (IpRun.STATUS_RUNNING.equals(run.getStatus()) && run.getNodeId().startsWith(REWRITE_NODE))
                spent += parse(run.getInputJson()).path("_director").path("then").path("maxCost").asLong(0);
        }
        for (JsonNode vj : p.path("videoJobs")) spent += vj.path("estimate").asLong();
        return spent;
    }

    /** 片段视频提交前要先改写的，返回改写的冻结上限（一键制作按它预留预算）；不用改写返回 0。 */
    private long rewriteReserve(ObjectNode c, JsonNode clip) {
        if (clip == null || !h3(limits(c))) return 0;
        try {
            Rewrite rw = rewrite(c, clip);
            return optimized(clip, rw) == null && !"original".equals(choice(clip, rw)) ? rewritePrice() : 0;
        } catch (BusinessException e) { return 0; }
    }

    /** 一次推进里的发任务助手：控制在途数量与预算。返回 false 表示这一轮不能再发了。 */
    private final class Step {
        final String userId; final DirectorWork w; final ObjectNode c, p; long committed; int inflight; final Set<String> busy;
        final long[] prices; final BillingSelection billing;
        Step(String userId, DirectorWork w, ObjectNode c, ObjectNode p, long spent, int inflight, Set<String> busy, long[] prices, BillingSelection billing) {
            this.userId = userId; this.w = w; this.c = c; this.p = p; this.committed = spent; this.inflight = inflight; this.busy = busy;
            this.prices = prices; this.billing = billing;
        }
        boolean send(String type, String target, String stage) {
            String node = switch (type) {
                case "asset-image" -> "asset:" + target; case "board" -> "board:" + target; case "video" -> "video:" + target;
                case "plan" -> "plan:" + target; case "extract" -> target == null ? "extract" : "extract:" + target;
                case "export" -> "export:" + target; default -> type;
            };
            if (busy.contains(node)) { p.put("stage", stage).put("message", stage); return true; }
            long estimate = "video".equals(type) ? videoQuote(userId, c, findOrNull(c, "clips", target))
                    : "export".equals(type) ? 0 : Set.of("asset-image", "board").contains(type) ? prices[1] : directorTextPrice(c, prices[0]);
            // H3 视频先改写提示词：改写不进视频报价，但要占一键制作的预算。
            long reserve = "video".equals(type) ? rewriteReserve(c, findOrNull(c, "clips", target)) : 0;
            p.put("stage", stage).put("message", stage);
            if (inflight >= PIPELINE_INFLIGHT) return false;
            if (committed + estimate + reserve > p.path("budget").asLong()) {
                p.put("status", "waiting").put("stage", "budget").put("message",
                        "预算不足：已用 " + committed + " 积分，下一步约需 " + (estimate + reserve) + " 积分。提高预算后可继续");
                return false;
            }
            // 序号要数上已发出的所有任务：真实视频只记在 videoJobs、不进 runIds，漏数它会让重试沿用旧编号、被回放成上次失败的任务。
            // 发送中途出错（还没记下）时序号不变，同一请求照旧幂等回放。
            String requestId = p.path("id").asText() + "-" + node.replace(':', '-') + "-"
                    + (p.path("runIds").size() + p.path("videoJobs").size() + 1);
            dispatch(userId, w, c, type, target, requestId, om.createObjectNode(), p, billing, estimate);
            committed += estimate + reserve; inflight++; busy.add(node);
            return inflight < PIPELINE_INFLIGHT;
        }
    }

    private static void finish(ObjectNode p, String status, String message) {
        p.put("status", status).put("message", message).put("finishedAt", Instant.now().toString());
    }

    private ObjectNode requirePipeline(JsonNode p) {
        if (!p.isObject()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_PIPELINE_MISSING", "没有进行中的一键制作");
        return (ObjectNode) p;
    }

    private static boolean auto(JsonNode p) { return p.path("auto").asBoolean(false); }

    private void confirmVideos(ObjectNode c, JsonNode p) {
        for (JsonNode clip : clipsOf(c, scopeEpisodes(c, p))) {
            ObjectNode slot = (ObjectNode) clip.path("video");
            if ("auto".equals(slot.path("adoptedBy").asText())) slot.put("adoptedBy", "user");
        }
    }

    /** 这一集最近一次导出：done（且用的正是当前采用的视频）/ running / failed / none。 */
    private String exportState(ObjectNode c, JsonNode ep) {
        JsonNode last = null;
        for (JsonNode e : c.path("exports")) if (ep.path("id").asText().equals(e.path("episodeId").asText())) last = e;
        if (last == null) return "none";
        String status = last.path("status").asText();
        if (!"done".equals(status)) return "running".equals(status) ? "running" : "failed";
        Map<String, String> used = new HashMap<>();
        last.path("clips").forEach(u -> used.put(u.path("clipId").asText(), u.path("candidateId").asText()));
        for (JsonNode clip : c.path("clips")) if (ep.path("id").asText().equals(clip.path("episodeId").asText())
                && !clip.path("video").path("adoptedId").asText().equals(used.get(clip.path("id").asText()))) return "none";
        return "done";
    }

    private List<JsonNode> scopeEpisodes(ObjectNode c, JsonNode p) {
        List<JsonNode> all = new ArrayList<>();
        c.path("episodes").forEach(all::add);
        if ("work".equals(p.path("scope").asText()) || all.isEmpty()) return all;
        String epId = p.path("episodeId").asText(null);
        if (epId == null) { ((ObjectNode) p).put("episodeId", all.get(0).path("id").asText()); return List.of(all.get(0)); }
        for (JsonNode e : all) if (e.path("id").asText().equals(epId)) return List.of(e);
        return List.of(all.get(0));
    }

    private List<JsonNode> clipsOf(ObjectNode c, List<JsonNode> eps) {
        Set<String> epIds = new HashSet<>();
        eps.forEach(e -> epIds.add(e.path("id").asText()));
        List<JsonNode> out = new ArrayList<>();
        for (JsonNode clip : c.path("clips")) if (epIds.contains(clip.path("episodeId").asText())) out.add(clip);
        return out;
    }

    private Set<String> neededAssets(ObjectNode c, JsonNode p) {
        Set<String> out = new LinkedHashSet<>();
        for (JsonNode clip : clipsOf(c, scopeEpisodes(c, p)))
            clip.path("assetIds").forEach(x -> { if (findOrNull(c, "assets", x.asText()) != null) out.add(x.asText()); });
        return out;
    }

    // ── 视频模型限制（片段时长来自所选模型的合同，不写死）─────────────────────

    /** mode：omni = 全能参考（分镜板 + 参考图 + 声音一起交给模型）；frame = 只按首帧出片（一镜一段，不带参考图和声音）。 */
    record Limits(String model, String name, int min, int max, boolean mock, String tier, List<String> aspects, boolean optimizable, String mode) {
        boolean frame() { return "frame".equals(mode); }
        int maxShots() { return frame() ? 1 : DirectorPrompts.MAX_SHOTS; }
    }
    record VideoChoice(String id, String name, boolean isDefault, int min, int max, String tier, List<String> aspects, boolean optimizable, String mode) {}

    private List<VideoChoice> videoChoices() {
        List<VideoChoice> out = new ArrayList<>();
        try {
            for (var m : videoModels.models()) {
                var contract = m.contract();
                if (contract == null || contract.modes() == null || contract.modes().stream().noneMatch(x -> VIDEO_MODE.equals(x.mode()))) continue;
                var tiers = contract.tiers() == null ? List.<com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTier>of() : contract.tiers();
                var tier = tiers.stream().filter(t -> "768p".equals(t.tier())).findFirst().orElse(tiers.isEmpty() ? null : tiers.get(0));
                List<String> aspects = new ArrayList<>();
                if (tier != null && tier.canvases() != null) tier.canvases().forEach(cv -> aspects.add(cv.aspectRatio()));
                out.add(new VideoChoice(m.endpointId(), m.name(), m.isDefault(), contract.minSeconds(), contract.maxSeconds(),
                        tier == null ? null : tier.tier(), aspects, m.supportsPromptOptimization(), "omni"));
            }
        } catch (BusinessException e) {
            log.warn("[director] 读取视频模型失败 reason={}", e.getMessage());
        }
        // 只支持单首帧的模型（没有保存视频规格、走旧首帧路径的端点）：时长取协议硬边界 ∩ 后台候选配置，
        // 不知道上限的不列出来，免得规划出模型做不了的片段。
        try {
            Set<String> seen = new HashSet<>();
            out.forEach(v -> seen.add(v.id()));
            for (var r : scenePolicies.studioVideoCandidates()) {
                var e = r.endpoint();
                if (!e.isEnabled() || !r.candidate().isEnabled() || seen.contains(e.getId()) || !videoClient.supportsLegacyFirstFrame(e)) continue;
                var bounds = videoClient.effectiveDurationBounds(e.getId(), e, "studio");
                if (bounds.maxSec() == null) continue;
                var geometry = videoClient.videoGeometry(e);
                out.add(new VideoChoice(e.getId(), e.publicModelName(), r.isDefault(), bounds.minSec() == null ? 1 : bounds.minSec(), bounds.maxSec(),
                        null, geometry == null || geometry.ratios() == null ? List.of() : geometry.ratios(), false, "frame"));
            }
        } catch (BusinessException e) {
            log.warn("[director] 读取首帧视频模型失败 reason={}", e.getMessage());
        }
        return out;
    }

    /** 作品选的视频模型（没选就用默认）。测试响应下没有真模型时按聚算 H3 的合同给一个标了 mock 的限制，只为本地走流程。 */
    private Limits limits(ObjectNode c) {
        List<VideoChoice> choices = videoChoices();
        String chosen = c.path("settings").path("videoModel").asText(null);
        VideoChoice pick = choices.stream().filter(v -> v.id().equals(chosen)).findFirst()
                .orElse(choices.stream().filter(VideoChoice::isDefault).findFirst().orElse(choices.isEmpty() ? null : choices.get(0)));
        if (pick != null) return new Limits(pick.id(), pick.name(), pick.min(), pick.max(), false, pick.tier(), pick.aspects(), pick.optimizable(), pick.mode());
        if (fixtures.enabled()) return new Limits(null, "测试响应", JusuanH3Contract.MIN_SECONDS, JusuanH3Contract.MAX_SECONDS, true,
                null, List.of("9:16", "16:9", "1:1"), false, "omni");
        return null;
    }

    /**
     * 导演台要出的画面比例：道具 1:1，角色、场景 16:9，分镜跟作品画幅走（9:16 / 16:9 / 1:1）。
     * 一部作品只选一个图片模型，它得三种都能出，否则总有一类画面出不了（2026-10-26 线上：作品选了
     * 只有横竖两种尺寸的 4K 接入点，三个道具全部失败）。
     */
    static final List<String> IMAGE_RATIOS = List.of("1:1", "16:9", "9:16");

    /**
     * 出图规格里缺的比例。没有出图规格的模型照旧用默认尺寸（{@link #sizeFor}），不按规格判断，返回空；
     * 规格读不出来就当三种都缺，不开放新选择。
     */
    static List<String> missingRatios(com.aistareco.aep.model.AiModelEndpoint endpoint) {
        com.aistareco.aep.model.AiImageRequestSpec spec;
        try { spec = com.aistareco.aep.model.AiImageRequestSpec.read(endpoint.getImageRequestSpecJson()); }
        catch (BusinessException e) { return IMAGE_RATIOS; }
        if (spec == null) return List.of();
        List<String> have = spec.ratios();
        return IMAGE_RATIOS.stream().filter(r -> !have.contains(r)).toList();
    }

    /** 新选择只能从这里选：场景开放、可用，出图规格覆盖三种比例。 */
    private List<com.aistareco.aep.service.AiAppSceneModelPolicyService.Selection> imageSelections() {
        return scenePolicies.available("studio", "image", textRuns.directorPrices(null)[1]).stream()
                .filter(s -> missingRatios(s.resolved().endpoint()).isEmpty()).toList();
    }

    private void requireSelectableImageModel(String id) {
        var found = scenePolicies.available("studio", "image", textRuns.directorPrices(null)[1]).stream()
                .filter(s -> s.resolved().endpoint().getId().equals(id)).findFirst()
                .orElseThrow(() -> invalid("该图片模型暂不可用，请选择其他模型"));
        List<String> missing = missingRatios(found.resolved().endpoint());
        if (!missing.isEmpty()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_IMAGE_MODEL_UNSUPPORTED",
                "「" + found.resolved().endpoint().publicModelName() + "」不能出 " + ratioNames(missing)
                        + "，导演台的道具、角色场景和分镜要用方图、横图和竖图。请选择其他图片模型",
                Map.of("missingRatios", missing));
    }

    /**
     * 作品实际会用的图片模型：设置里存着的（不在可选列表里也照用、照原价），没存就用默认。
     * 停用了或不再开放就明确报错，不换成别的模型。
     */
    com.aistareco.aep.service.AiAppSceneModelPolicyService.Selection imageSelection(ObjectNode c) {
        String chosen = c.path("settings").path("imageModel").asText(null);
        try {
            return scenePolicies.resolve("studio", "image", chosen, textRuns.directorPrices(null)[1]);
        } catch (BusinessException e) {
            if (!"ENDPOINT_NOT_ALLOWED".equals(e.getCode())) throw e;
            throw new BusinessException(e.getStatus(), e.getCode(), chosen == null
                    ? "默认图片模型暂不可用，请在作品设置里选择其他图片模型，或联系管理员"
                    : "作品设置里选的图片模型已停用或不再开放，请在作品设置里换一个图片模型", e.getDetails(), e.getMessage());
        }
    }

    long[] directorPrices(ObjectNode c) {
        long[] prices;
        // 存着的文本模型停用了就按默认价展示，提交时 submitDirectorText 会明确报错，页面不因此打不开。
        try { prices = textRuns.directorPrices(textModel(c)).clone(); }
        catch (BusinessException e) { prices = textRuns.directorPrices(null).clone(); }
        if (!fixtures.enabled()) {
            // 和真正提交用同一个解析：存着的旧选择不在可选列表里也照原价，提交时的 maxCost 才对得上。
            // 停用了就留默认价，提交会明确报错，页面看 imageModelState。
            try {
                var selection = imageSelection(c);
                if (selection != null) prices[1] = selection.creditCost();
            } catch (BusinessException ignored) { }
        }
        return prices;
    }

    /**
     * 作品实际会用的图片模型的状况，设置页据此说明：available=false 是停用了或不再开放，生成会报错；
     * missingRatios 不为空是还能用，但对应的那几类画面出不了。
     */
    private ObjectNode imageModelState(ObjectNode c) {
        String chosen = c.path("settings").path("imageModel").asText(null);
        ObjectNode s = om.createObjectNode().put("id", chosen).put("explicit", chosen != null);
        s.putNull("name").putNull("creditCost").put("available", true).putArray("missingRatios");
        if (fixtures.enabled()) return s;
        try {
            var selection = imageSelection(c);
            if (selection == null) return s;
            var endpoint = selection.resolved().endpoint();
            s.put("id", endpoint.getId()).put("name", endpoint.publicModelName()).put("creditCost", selection.creditCost());
            s.set("missingRatios", om.valueToTree(missingRatios(endpoint)));
        } catch (BusinessException e) {
            s.put("available", false);
        }
        return s;
    }

    private static String ratioNames(List<String> ratios) {
        return String.join("、", ratios.stream().map(DirectorService::ratioName).toList());
    }

    private static String ratioName(String ratio) {
        return switch (ratio) { case "1:1" -> "1:1 方图"; case "16:9" -> "16:9 横图"; case "9:16" -> "9:16 竖图"; default -> ratio + " 画面"; };
    }

    /** 作品选的文本模型；null = 后台默认。普通文字任务的估价与提交读这一处；H3 优化用独立用途绑定。 */
    private static String textModel(ObjectNode c) {
        return c.path("settings").path("textModel").asText(null);
    }

    private long directorTextPrice(ObjectNode c, long fallback) {
        long price;
        try { price = textRuns.directorTextPrice(textModel(c)); }
        catch (BusinessException e) { return fallback; }
        return price > 0 ? price : fallback;
    }

    // ── 出 wire ───────────────────────────────────────────────────────────────

    private JsonNode view(String userId, DirectorWork w, ObjectNode c) {
        ObjectNode v = c.deepCopy();
        v.remove("applied"); v.remove("taskMeta"); v.remove("seq"); v.remove("splitUndo");
        if (!v.path("reference").isTextual()) v.put("reference", "");
        if (!v.has("referenceRev")) v.put("referenceRev", 0);
        if (!v.has("pendingSplit")) v.putNull("pendingSplit");
        // 撤销拆分：拆分前的原稿还在、还没出过分镜图或视频才可用。
        boolean media = false;
        for (JsonNode clip : c.path("clips")) media |= hasMedia(clip);
        v.put("canUndoSplit", c.path("splitUndo").isObject() && c.path("episodes").size() > 0 && !media);
        // 剧本里标好的分集数：拆分按钮据此说明「按标题分、不花积分」。
        int heads = c.path("episodes").isEmpty() ? DirectorPrompts.headingStarts(paragraphs(c.path("draft").asText())).size() : 0;
        v.put("draftEpisodeHeadings", heads);
        v.put("id", w.getId()).put("title", w.getTitle()).put("revision", w.getRevision())
                .put("createdAt", w.getCreatedAt().toString()).put("updatedAt", w.getUpdatedAt().toString());
        ArrayNode tasks = v.putArray("tasks");
        // 在新事务里读：本次请求刚在独立事务里建的任务，MySQL 可重复读下外层事务的快照看不到，
        // 页面会以为没在生成、也不轮询（2026-10-24 线上：点「生成剧本」没反应，再点报「该项生成中」）。
        List<IpRun> mine = newTx.execute(tx -> runs.findByProjectIdOrderByCreatedAtDesc(w.getId()));
        for (IpRun r : mine.subList(0, Math.min(40, mine.size()))) {
            tasks.addObject().put("id", r.getId()).put("target", r.getNodeId()).put("status",IpRun.STATUS_RUNNING.equals(r.getStatus())&&r.isCancelRequested()&&"studio-director".equals(r.getKind())?"stopping":r.getStatus())
                    .put("canStop",IpRun.STATUS_RUNNING.equals(r.getStatus())&&!r.isCancelRequested()&&"studio-director".equals(r.getKind()))
                    .put("stage", r.getStage()).put("cost", r.getCost()).put("errorMessage", r.getErrorMessage())
                    .put("createdAt", r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
        }
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            tasks.insertObject(0).put("id", pend.path("jobId").asText()).put("target", "video:" + clip.path("id").asText()).put("status", "running")
                    .put("stage", pend.path("stage").asText()).put("cost", 0).putNull("errorMessage").put("createdAt", pend.path("at").asText());
        long[] prices = directorPrices(c);
        v.putObject("pricing").put("textMax", prices[0]).put("image", prices[1]).put("mock", fixtures.enabled());
        ArrayNode imageModels = v.putArray("imageModels");
        for (var selection : imageSelections()) {
            var endpoint = selection.resolved().endpoint();
            imageModels.addObject().put("id", endpoint.getId()).put("name", endpoint.publicModelName())
                    .put("isDefault", selection.resolved().isDefault()).put("creditCost", selection.creditCost());
        }
        v.set("imageModelState", imageModelState(c));
        var textCapabilities = textRuns.capabilities();
        v.set("textModels", om.valueToTree(textCapabilities.textModels()));
        v.put("textModelMode", textCapabilities.textModelMode());
        ArrayNode models = v.putArray("videoModels");
        for (VideoChoice m : videoChoices())
            models.addObject().put("id", m.id()).put("name", m.name()).put("isDefault", m.isDefault()).put("minSec", m.min()).put("maxSec", m.max()).put("mode", m.mode());
        Limits lim = limits(c);
        if (lim == null) v.putNull("videoLimits");
        else v.putObject("videoLimits").put("model", lim.model()).put("name", lim.name()).put("minSec", lim.min()).put("maxSec", lim.max()).put("mock", lim.mock())
                .put("mode", lim.mode()).put("maxShots", lim.maxShots());
        List<String> keys = new ArrayList<>();
        collectKeys(v, keys);
        Map<String, String> signed = sign(userId, keys);
        attachUrls(v, signed);
        return v;
    }

    private void collectKeys(JsonNode n, List<String> keys) {
        if (n.isObject()) {
            if (n.path("key").isTextual()) keys.add(n.path("key").asText());
            n.forEach(x -> collectKeys(x, keys));
        } else if (n.isArray()) n.forEach(x -> collectKeys(x, keys));
    }

    private void attachUrls(JsonNode n, Map<String, String> signed) {
        if (n.isObject()) {
            if (n.path("key").isTextual()) ((ObjectNode) n).put("url", signed.get(n.path("key").asText()));
            n.forEach(x -> attachUrls(x, signed));
        } else if (n.isArray()) n.forEach(x -> attachUrls(x, signed));
    }

    private Map<String, String> sign(String userId, List<String> keys) {
        Map<String, String> out = new HashMap<>();
        List<String> unique = new ArrayList<>(new LinkedHashSet<>(keys));
        for (int i = 0; i < unique.size(); i += 150) {
            try { out.putAll(projects.signOwnedKeys(userId, unique.subList(i, Math.min(unique.size(), i + 150)))); }
            catch (BusinessException e) { log.warn("[director] 签名失败 user={} reason={}", userId, e.getMessage()); }
        }
        return out;
    }

    // ── 编译媒体提示词与片段检查 ─────────────────────────────────────────────

    /** 重新编译没被改写过的提示词，并按当前视频模型重算每个片段「需要修改」的问题。包内可见供测试。 */
    void refresh(ObjectNode c) {
        Limits lim = limits(c);
        Map<String, String> names = new HashMap<>();
        Set<String> characters = new HashSet<>();
        for (JsonNode a : c.path("assets")) {
            if (!a.path("promptCustom").asBoolean(false)) ((ObjectNode) a).put("prompt", DirectorPrompts.assetPrompt(c.path("settings"), a));
            checkAsset((ObjectNode) a);
            names.put(a.path("id").asText(), a.path("name").asText());
            if ("character".equals(a.path("kind").asText())) characters.add(a.path("id").asText());
        }
        Map<String, Integer> lastOrder = new HashMap<>();
        for (JsonNode clip : c.path("clips")) lastOrder.merge(clip.path("episodeId").asText(), clip.path("order").asInt(), Math::max);
        for (JsonNode clipNode : c.path("clips")) {
            ObjectNode clip = (ObjectNode) clipNode;
            List<DirectorPrompts.Ref> refs = new ArrayList<>();
            for (JsonNode a : visualAssets(c, clip))
                refs.add(new DirectorPrompts.Ref("图" + (refs.size() + 1), a.path("kind").asText(), a.path("name").asText()));
            if (!clip.path("boardPromptCustom").asBoolean(false))
                clip.put("boardPrompt", DirectorPrompts.boardPrompt(c.path("settings"), clip, refs, names));
            VideoParts parts = videoParts(c, clip, refs, names);
            ArrayNode unvoicedNode = clip.putArray("unvoiced");
            parts.unvoiced().forEach(unvoicedNode::add);
            ArrayNode voicedNode = clip.putArray("voiced");
            parts.voices().forEach(v -> voicedNode.add(v.name()));
            if (!clip.path("videoPromptCustom").asBoolean(false))
                clip.put("videoPrompt", lim != null && lim.frame() ? DirectorPrompts.framePrompt(c.path("settings"), clip, names, parts.voiceDescs())
                        : DirectorPrompts.videoPrompt(c.path("settings"), clip, parts.videoRefs(), names, parts.voices(), parts.unvoiced(), parts.voiceDescs()));
            ArrayNode issues = clip.putArray("issues");
            int shots = clip.path("shots").size();
            if (shots == 0) issues.add("暂无镜头：请添加镜头或重写本集分镜脚本");
            if (lim != null && lim.frame() && shots > 1)
                issues.add("视频模型「" + lim.name() + "」仅使用分镜首帧，每个片段限 1 个镜头，当前有 " + shots + " 个。请拆分或重新规划本集");
            else if (shots > DirectorPrompts.MAX_SHOTS) issues.add("有 " + shots + " 个镜头，分镜板最多 " + DirectorPrompts.MAX_SHOTS + " 格。请拆分片段或删除多余镜头");
            double total = 0;
            for (JsonNode s : clip.path("shots")) total += s.path("durationSec").asDouble();
            if (lim != null && Math.abs(total - Math.rint(total)) > 1e-6)
                issues.add("片段共 " + fmt(total) + " 秒，视频模型仅支持整数秒。请调整镜头时长");
            if (lim != null && (total < lim.min() || total > lim.max()))
                issues.add("片段共 " + fmt(total) + " 秒，视频模型「" + lim.name() + "」支持 " + lim.min() + "–" + lim.max() + " 秒。请调整镜头时长或拆分片段");
            for (JsonNode idNode : clip.path("assetIds"))
                if (!names.containsKey(idNode.asText())) issues.add("关联的资产「" + idNode.asText() + "」不在资产列表中，请重新选择关联资产");
            Set<String> badSpeakers = new LinkedHashSet<>();
            for (JsonNode s : clip.path("shots")) for (JsonNode line : s.path("dialogue")) {
                String sp = line.path("speakerId").asText(null);
                if (sp != null && !characters.contains(sp)) badSpeakers.add(names.getOrDefault(sp, sp));
            }
            for (String sp : badSpeakers) issues.add("台词说话人「" + sp + "」不是角色，请重新选择说话人");
            clip.set("warnings", shotWarnings(clip, lim, total, lastOrder.getOrDefault(clip.path("episodeId").asText(), 0)));
            clip.put("videoPromptRewrite", rewriteState(c, clip, lim));
            check((ObjectNode) clip.path("board"), boardCurrent(c, clip), null, false);
            String legacy = legacyVideoPrompt(c, clip, lim, parts, names);
            check((ObjectNode) clip.path("video"), videoCurrent(c, clip, lim), legacy == null ? null : videoCurrent(c, clip, lim, legacy), true);
        }
    }

    /** 编视频提示词要用的东西：参考图编号（图1 是分镜图，资产从图2 起）、绑了声音的说话人、没绑的、音色描述。 */
    private record VideoParts(List<DirectorPrompts.Ref> videoRefs, List<DirectorPrompts.VoiceRef> voices, List<String> unvoiced,
                              Map<String, String> voiceDescs) {}

    private VideoParts videoParts(ObjectNode c, JsonNode clip, List<DirectorPrompts.Ref> refs, Map<String, String> names) {
        List<DirectorPrompts.Ref> videoRefs = new ArrayList<>();
        for (DirectorPrompts.Ref r : refs) videoRefs.add(new DirectorPrompts.Ref("图" + (videoRefs.size() + 2), r.kind(), r.name()));
        List<DirectorPrompts.VoiceRef> voices = new ArrayList<>();
        List<String> unvoiced = new ArrayList<>();
        Map<String, String> voiceDescs = new LinkedHashMap<>();
        for (JsonNode a : speakers(c, clip)) {
            if (!a.path("voiceDesc").asText().isBlank()) voiceDescs.put(a.path("name").asText(), a.path("voiceDesc").asText().trim());
            if (a.path("voice").path("key").isTextual()) voices.add(new DirectorPrompts.VoiceRef("音频" + (voices.size() + 1), a.path("name").asText()));
            else unvoiced.add(a.path("name").asText());
        }
        return new VideoParts(videoRefs, voices, unvoiced, voiceDescs);
    }

    /**
     * 按旧模板（2026-10-26 之前的格式）编出的这一段提示词，只用来核对旧格式生成的视频：换模板本身不算「镜头、台词或提示词已修改」。
     * 用户改写过提示词、或首帧出片（模板没换）时两边一样，返回 null。
     */
    private String legacyVideoPrompt(ObjectNode c, JsonNode clip, Limits lim, VideoParts parts, Map<String, String> names) {
        if (clip.path("videoPromptCustom").asBoolean(false) || (lim != null && lim.frame())) return null;
        return DirectorPrompts.legacyVideoPrompt(c.path("settings"), clip, parts.videoRefs(), names, parts.voices(), parts.unvoiced(), parts.voiceDescs());
    }

    private String legacyVideoPrompt(ObjectNode c, JsonNode clip, Limits lim) {
        Map<String, String> names = new HashMap<>();
        for (JsonNode a : c.path("assets")) names.put(a.path("id").asText(), a.path("name").asText());
        List<DirectorPrompts.Ref> refs = new ArrayList<>();
        for (JsonNode a : visualAssets(c, clip))
            refs.add(new DirectorPrompts.Ref("图" + (refs.size() + 1), a.path("kind").asText(), a.path("name").asText()));
        return legacyVideoPrompt(c, clip, lim, videoParts(c, clip, refs, names), names);
    }

    /** 片段里说台词的角色（按第一次开口的顺序），视频的声音参考按这个顺序编号。 */
    private List<JsonNode> speakers(ObjectNode c, JsonNode clip) {
        List<JsonNode> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode s : clip.path("shots")) for (JsonNode line : s.path("dialogue")) {
            String id = line.path("speakerId").asText(null);
            JsonNode a = findOrNull(c, "assets", id);
            if (a != null && "character".equals(a.path("kind").asText()) && seen.add(id)) out.add(a);
        }
        return out;
    }

    private String assetFingerprint(JsonNode a) {
        String ref = characterRefKey(a);
        // 没有形象参考时保持旧指纹，已采用的图不会因为这次改动被标成「需更新」。
        return hash(a.path("prompt").asText() + "|" + a.path("kind").asText() + (ref == null ? "" : "|ref:" + ref));
    }

    private static String characterRefKey(JsonNode a) {
        if (!"character".equals(a.path("kind").asText())) return null;
        String key = a.path("refImage").path("key").asText(null);
        return key == null || key.isBlank() ? null : key;
    }

    private String boardFingerprint(JsonNode clip, List<Bound> refs) {
        StringBuilder b = new StringBuilder(clip.path("boardPrompt").asText());
        for (Bound r : refs) b.append('|').append(r.key());
        return hash(b.toString());
    }

    private String boardFingerprintOrNull(ObjectNode c, JsonNode clip) {
        return boardCurrent(c, clip).fingerprint();
    }

    // ── 采用版本是否还跟当前设置一致 ─────────────────────────────────────────
    // 生成时记下的指纹（提示词 + 实际参考 key + 时长 / 画幅 / 模型）和按当前设置算出来的比；
    // 老数据没有指纹就比提示词和参考 key，连这些也没有就如实标「未核对」。不自动重跑。

    /** 按当前设置，下一次生成会用的东西。images / audios 是请求里的实际 key（顺序与提交时一致）。 */
    private record Current(String fingerprint, String prompt, List<String> images, List<String> audios) {}

    private List<String> adoptedAssetKeys(ObjectNode c, JsonNode clip) {
        List<String> keys = new ArrayList<>();
        for (String kind : List.of("character", "scene", "prop"))
            for (JsonNode idNode : clip.path("assetIds")) {
                JsonNode a = findOrNull(c, "assets", idNode.asText());
                if (a == null || !kind.equals(a.path("kind").asText()) || audioOnly(a)) continue;
                String key = adoptedKey(a.path("image"));
                if (key != null) keys.add(key);
            }
        return keys;
    }

    private Current boardCurrent(ObjectNode c, JsonNode clip) {
        String prompt = clip.path("boardPrompt").asText();
        List<String> images = adoptedAssetKeys(c, clip);
        StringBuilder b = new StringBuilder(prompt);
        images.forEach(k -> b.append('|').append(k));
        return new Current(hash(b.toString()), prompt, images, List.of());
    }

    private Current videoCurrent(ObjectNode c, JsonNode clip, Limits lim) {
        return videoCurrent(c, clip, lim, clip.path("videoPrompt").asText());
    }

    private Current videoCurrent(ObjectNode c, JsonNode clip, Limits lim, String prompt) {
        int duration = (int) Math.round(clip.path("durationSec").asDouble());
        String aspect = c.path("settings").path("aspectRatio").asText("9:16");
        List<String> images = new ArrayList<>();
        String board = adoptedKey(clip.path("board"));
        if (board != null) images.add(board);
        List<String> audios = new ArrayList<>();
        if (lim != null && lim.frame()) {
            // 首帧出片只交分镜画面，参考图和声音不进请求，也就不参与核对。
            StringBuilder b = new StringBuilder("frame|").append(prompt).append('|').append(duration).append('|').append(aspect).append('|').append(lim.model());
            images.forEach(k -> b.append('|').append(k));
            return new Current(hash(b.toString()), prompt, images, audios);
        }
        images.addAll(adoptedAssetKeys(c, clip));
        for (JsonNode a : speakers(c, clip)) { String k = a.path("voice").path("key").asText(null); if (k != null) audios.add(k); }
        StringBuilder b = new StringBuilder(prompt).append('|').append(duration).append('|').append(aspect).append('|').append(lim == null ? null : lim.model());
        images.forEach(k -> b.append('|').append(k));
        audios.forEach(k -> b.append('|').append(k));
        return new Current(hash(b.toString()), prompt, images, audios);
    }

    /** 给采用位写 adoptedCheck（current / outdated / unknown）和 staleReasons（说人话的原因）。 */
    private void check(ObjectNode slot, Current current, Current legacy, boolean video) {
        ArrayNode reasons = slot.putArray("staleReasons");
        JsonNode m = null;
        String id = slot.path("adoptedId").asText(null);
        for (JsonNode x : slot.path("candidates")) if (x.path("id").asText().equals(id)) m = x;
        if (m == null) { slot.putNull("adoptedCheck"); return; }
        // 旧格式提示词生成的视频按旧模板核对，换模板本身不算修改（legacy 为 null 表示两种格式一样）。
        Current now = legacy != null && !m.has("promptFormat") ? legacy : current;
        if (Set.of("upload", "library").contains(m.path("source").asText())) { slot.put("adoptedCheck", "current"); return; }
        boolean hasRefs = m.has("refs") && m.has("prompt");
        if (!m.hasNonNull("fingerprint") && !hasRefs) { slot.put("adoptedCheck", "unknown"); return; }
        if (m.hasNonNull("fingerprint") && m.path("fingerprint").asText().equals(now.fingerprint())) { slot.put("adoptedCheck", "current"); return; }
        List<String> images = new ArrayList<>(), audios = new ArrayList<>();
        for (JsonNode r : m.path("refs")) (r.path("label").asText().startsWith("音频") ? audios : images).add(r.path("key").asText());
        if (hasRefs) {
            if (!audios.equals(now.audios())) reasons.add(now.audios().isEmpty() ? "角色声音已移除" : audios.isEmpty() ? "角色已绑定声音" : "角色声音已更换");
            if (!images.equals(now.images())) reasons.add(video ? "分镜图或参考图已更换" : "参考图已更换");
            if (!withoutVoiceLines(m.path("prompt").asText()).equals(withoutVoiceLines(now.prompt()))) reasons.add("镜头、台词或提示词已修改");
        }
        if (reasons.isEmpty() && m.hasNonNull("fingerprint")) reasons.add(video ? "时长、画幅或视频模型已修改" : "设置已修改");
        slot.put("adoptedCheck", reasons.isEmpty() ? "current" : "outdated");
    }

    /** 声音绑定会改写视频提示词里的声音说明行；比较「镜头、台词或提示词」时去掉这几行，免得换声音也报成改了镜头。 */
    private static String withoutVoiceLines(String prompt) {
        StringBuilder b = new StringBuilder();
        for (String line : prompt.split("\n")) if (!line.startsWith("声音参考：") && !line.endsWith("没有声音参考，按人物身份自然配音。")) b.append(line).append('\n');
        return b.toString();
    }

    private void checkAsset(ObjectNode a) {
        ObjectNode slot = (ObjectNode) a.path("image");
        ArrayNode reasons = slot.putArray("staleReasons");
        JsonNode m = null;
        String id = slot.path("adoptedId").asText(null);
        for (JsonNode x : slot.path("candidates")) if (x.path("id").asText().equals(id)) m = x;
        if (m == null) { slot.putNull("adoptedCheck"); return; }
        if (Set.of("upload", "library").contains(m.path("source").asText())) { slot.put("adoptedCheck", "current"); return; }
        if (m.hasNonNull("fingerprint")) {
            boolean same = m.path("fingerprint").asText().equals(assetFingerprint(a));
            if (!same) reasons.add("描述或出图提示词已修改");
            slot.put("adoptedCheck", same ? "current" : "outdated");
        } else if (m.has("prompt")) {
            boolean same = m.path("prompt").asText().equals(a.path("prompt").asText());
            if (!same) reasons.add("描述或出图提示词已修改");
            slot.put("adoptedCheck", same ? "current" : "outdated");
        } else slot.put("adoptedCheck", "unknown");
    }

    /** 本集片段的修订基线：片段 id 与 rev。规划期间有任何增删改，回投时就不替换。 */
    private String clipsHash(ObjectNode c, String episodeId) {
        StringBuilder b = new StringBuilder();
        for (JsonNode clip : c.path("clips")) if (episodeId.equals(clip.path("episodeId").asText()))
            b.append(clip.path("id").asText()).append(':').append(clip.path("rev").asLong()).append(';');
        return hash(b.toString());
    }

    /**
     * 先定画面比例，再按当前图片模型的出图规格选这个比例的尺寸：各模型同一比例的像素不一样
     * （GPT Image 2 的 16:9 是 1360x768，聚算三款是 1365x768），写死尺寸会被规格校验拒掉（2026-10-25 线上）。
     * 没有出图规格的模型（走 dap 多模态链）照旧用默认尺寸。
     */
    private String sizeFor(ObjectNode c, String kind) {
        String ratio = switch (kind) {
            case "prop" -> "1:1";
            case "scene", "character" -> "16:9"; // 场景是横向空间图，角色设定集是横版排版
            default -> c.path("settings").path("aspectRatio").asText("9:16");
        };
        String fallback = switch (ratio) { case "16:9" -> "1365x768"; case "1:1" -> "1024x1024"; default -> "768x1365"; };
        if (fixtures.enabled()) return fallback;
        var endpoint = imageSelection(c).resolved().endpoint();
        var spec = com.aistareco.aep.model.AiImageRequestSpec.read(endpoint.getImageRequestSpecJson());
        if (spec == null) return fallback;
        // 同一比例有几档时取最大的：设定集、宫格分镜图要放好几个分区，小图细节糊。只在这一个接入点的尺寸里挑，
        // 按张计费，价格不变；不跨到同系列的别的接入点（4K 是另一个接入点、另一个价）。
        // 线上 GPT Image 2 的 1360x768 偶尔被厂商按 4:3 出图、被尺寸校验拦下，2048x1152 一周内没有出过错（2026-10-25 日志）。
        return spec.outputs().stream().filter(o -> ratio.equals(o.aspectRatio()))
                .map(com.aistareco.aep.model.AiImageRequestSpec.Output::canvasSize)
                .max(Comparator.comparingLong(DirectorService::pixels))
                .orElseThrow(() -> sizeUnsupported(c, kind, ratio, endpoint));
    }

    /**
     * 当前图片模型出不了这一类画面。道具、角色、场景的比例是固定的，改作品画幅没用，只能换模型；
     * 分镜跟作品画幅走，两样都能改。在建任务、冻结积分之前抛。
     */
    private static BusinessException sizeUnsupported(ObjectNode c, String kind, String ratio, com.aistareco.aep.model.AiModelEndpoint endpoint) {
        String model = (c.path("settings").hasNonNull("imageModel") ? "作品设置里选的图片模型「" : "默认图片模型「")
                + endpoint.publicModelName() + "」不能出 " + ratioName(ratio) + "，";
        String message = switch (kind) {
            case "prop" -> model + "道具参考图要用方图。请在作品设置里换一个能出方图的图片模型";
            case "character" -> model + "角色参考图要用横图。请在作品设置里换一个能出横图的图片模型";
            case "scene" -> model + "场景参考图要用横图。请在作品设置里换一个能出横图的图片模型";
            default -> model + "分镜图跟作品画幅走。请在作品设置里换一个画幅，或换一个图片模型";
        };
        return new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_IMAGE_SIZE_UNSUPPORTED", message,
                Map.of("kind", kind, "aspectRatio", ratio, "missingRatios", missingRatios(endpoint)));
    }

    // ── 内容小工具 ───────────────────────────────────────────────────────────

    /** 一集的段落区间（都含）。 */
    record SplitRange(String title, String summary, int start, int end) {}

    /**
     * 待确认的分集：每集的范围、篇幅、开头结尾各一句，以及程序做过的修正。不放正文，确认时按范围从当前剧本取，
     * 剧本在这期间改过（哈希对不上）就作废。第一集之前的段落是设定资料，确认时由用户决定保留还是并入第一集。
     */
    private ObjectNode pendingSplit(ObjectNode c, String runId, String source, List<String> ps, List<SplitRange> ranges,
                                    List<String> notes, List<String> warnings) {
        ObjectNode p = om.createObjectNode().put("id", nextId(c, "sp")).put("runId", runId).put("source", source)
                .put("at", Instant.now().toString()).put("draftHash", hash(c.path("draft").asText())).put("paragraphCount", ps.size());
        int bodyStart = ranges.get(0).start();
        if (bodyStart > 0) p.set("preamble", rangeView(ps, 0, bodyStart - 1)); else p.putNull("preamble");
        ArrayNode eps = p.putArray("episodes");
        for (SplitRange r : ranges) {
            ObjectNode e = rangeView(ps, r.start(), r.end()).put("title", r.title()).put("summary", r.summary());
            e.put("startParagraph", r.start()).put("endParagraph", r.end());
            eps.add(e);
        }
        p.set("notes", om.valueToTree(notes));
        p.set("warnings", om.valueToTree(warnings));
        return p;
    }

    private ObjectNode rangeView(List<String> ps, int from, int to) {
        int chars = 0;
        for (int i = from; i <= to; i++) chars += ps.get(i).replaceAll("\\s", "").length();
        return om.createObjectNode().put("paragraphs", to - from + 1).put("chars", chars).put("head", snippet(ps.get(from))).put("tail", snippet(ps.get(to)));
    }

    private static String snippet(String p) {
        String t = p.replaceAll("^#+\\s*", "").strip();
        return t.length() <= 30 ? t : t.substring(0, 30) + "…";
    }

    /** Numbered nonblank lines locate slices; copying the source retains indentation, blank lines and CRLF. */
    private static String sliceParagraphs(String original, int from, int to) {
        List<Integer> offsets = new ArrayList<>();
        int offset = 0;
        for (String line : original.split("(?<=\\n)", -1)) {
            if (!line.isBlank()) offsets.add(offset);
            offset += line.length();
        }
        if (from < 0 || to < from || to >= offsets.size()) throw new IllegalArgumentException("Invalid split paragraph range");
        int start = from == 0 ? 0 : offsets.get(from);
        int end = to + 1 < offsets.size() ? offsets.get(to + 1) : original.length();
        return original.substring(start, end);
    }

    /**
     * 采用待确认的分集：按范围从当前剧本取正文建集；第一集之前的设定资料默认存进 {@code reference}，
     * {@code preambleAsEpisode} 时并入第一集。拆分前的原稿留底（{@code splitUndo}），还没出图出视频时可以撤销。
     */
    private int applySplit(ObjectNode c, JsonNode pending, boolean preambleAsEpisode) {
        String draft = c.path("draft").asText();
        if (c.path("episodes").size() > 0 || !hash(draft).equals(pending.path("draftHash").asText()))
            throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SPLIT_EXPIRED", "剧本已修改，这份分集结果已失效，请重新拆分");
        keepSplitUndo(c);
        JsonNode eps = pending.path("episodes");
        int bodyStart = eps.get(0).path("startParagraph").asInt();
        if (bodyStart > 0 && !preambleAsEpisode) {
            String old = c.path("reference").asText().strip(), pre = sliceParagraphs(draft, 0, bodyStart - 1);
            c.put("reference", old.isEmpty() ? pre : old + "\n\n" + pre).put("referenceRev", c.path("referenceRev").asLong() + 1);
        }
        int no = 1;
        for (JsonNode e : eps) {
            int start = no == 1 && preambleAsEpisode ? 0 : e.path("startParagraph").asInt();
            ((ArrayNode) c.path("episodes")).add(newEpisode(c, no++, e.path("title").asText(), e.path("summary").asText(),
                    sliceParagraphs(draft, start, e.path("endParagraph").asInt())));
        }
        c.put("draft", "").put("draftRev", c.path("draftRev").asLong() + 1);
        c.putNull("pendingSplit");
        return eps.size();
    }

    /**
     * 剧本里已经标好「第N集」：直接按标题分，不调模型、不扣积分（结果同样先给用户确认）。
     * 用户另外指定了不同的集数（{@code target > 0}）才交给模型。
     */
    private boolean splitByHeadings(ObjectNode c, int target) {
        List<String> ps = paragraphs(c.path("draft").asText());
        List<Integer> heads = DirectorPrompts.headingStarts(ps);
        if (heads.isEmpty() || target > 0 && target != heads.size()) return false;
        List<SplitRange> ranges = new ArrayList<>();
        for (int i = 0; i < heads.size(); i++)
            ranges.add(new SplitRange(DirectorPrompts.headingTitle(ps.get(heads.get(i))), "",
                    heads.get(i), i + 1 < heads.size() ? heads.get(i + 1) - 1 : ps.size() - 1));
        c.set("pendingSplit", pendingSplit(c, null, "headings", ps, ranges, List.of(), List.of()));
        return true;
    }

    /** 全自动采用分集时的说明：分了几集、开头资料放哪了、程序补了什么，用户据此决定要不要改回。 */
    private static String splitNotice(int n, JsonNode pending) {
        StringBuilder b = new StringBuilder("已自动分成 ").append(n).append(" 集");
        JsonNode pre = pending.path("preamble");
        if (pre.isObject()) b.append("；剧本开头 ").append(pre.path("paragraphs").asInt()).append(" 段放进了设定资料，不会拍成画面，如果是正片可在「剧本」中并入第 1 集");
        pending.path("notes").forEach(x -> b.append("；").append(x.asText()));
        pending.path("warnings").forEach(x -> b.append("；").append(x.asText()));
        return b.toString();
    }

    private void asOneEpisode(DirectorWork w, ObjectNode c) {
        keepSplitUndo(c);
        ((ArrayNode) c.path("episodes")).add(newEpisode(c, 1, w.getTitle(), "", c.path("draft").asText()));
        c.put("draft", "").put("draftRev", c.path("draftRev").asLong() + 1);
        c.putNull("pendingSplit");
    }

    private void keepSplitUndo(ObjectNode c) {
        c.putObject("splitUndo").put("draft", c.path("draft").asText()).put("reference", c.path("reference").asText()).put("at", Instant.now().toString());
    }

    private ObjectNode newEpisode(ObjectNode c, int no, String title, String summary, String content) {
        String t = title == null || title.isBlank() ? "第 " + no + " 集" : title.trim();
        ObjectNode ep = om.createObjectNode().put("id", nextId(c, "ep")).put("no", no).put("title", t)
                .put("summary", summary == null ? "" : summary).put("content", content).put("extracted", false).put("planStale", false).put("rev", 1);
        ep.putNull("planError"); ep.putNull("pendingPlan");
        return ep;
    }

    private ObjectNode newAsset(ObjectNode c, String kind, String name, String description) {
        ObjectNode a = om.createObjectNode().put("id", nextId(c, "as")).put("kind", kind).put("name", name)
                .put("description", description == null ? "" : description).put("prompt", "").put("promptCustom", false).put("rev", 1);
        a.putArray("aliases"); a.putArray("episodeIds"); a.set("image", emptySlot()); a.putNull("voice");
        return a;
    }

    private ObjectNode newClip(ObjectNode c, String episodeId, String title, String summary) {
        ObjectNode clip = om.createObjectNode().put("id", nextId(c, "cl")).put("episodeId", episodeId).put("order", 0)
                .put("title", title == null ? "" : title).put("summary", summary == null ? "" : summary).put("durationSec", 0);
        clip.putArray("assetIds"); clip.putArray("shots"); clip.putArray("issues");
        clip.put("boardPrompt", "").put("boardPromptCustom", false).put("videoPrompt", "").put("videoPromptCustom", false);
        clip.remove("videoPromptEn");
        clip.set("board", emptySlot()); clip.set("video", emptySlot());
        clip.put("rev", 1);
        return clip;
    }

    private void renumber(ObjectNode c, String episodeId) {
        int order = 1;
        for (JsonNode clip : c.path("clips")) if (episodeId.equals(clip.path("episodeId").asText())) ((ObjectNode) clip).put("order", order++);
    }

    private ObjectNode emptySlot() {
        ObjectNode s = om.createObjectNode();
        s.putArray("candidates"); s.putNull("adoptedId"); s.putNull("adoptedBy"); s.putNull("error");
        return s;
    }

    /**
     * 写入镜头。用户提交（{@code fromUser=true}）的内容超长或时长无效直接报错，不截断、不改写；
     * 镜头数、总时长是否满足模型合同由 {@link #refresh} 标成片段问题，不在这里丢镜头。
     */
    private void setShots(ObjectNode c, ObjectNode clip, JsonNode shots, boolean fromUser) {
        ArrayNode out = om.createArrayNode();
        double t = 0;
        for (JsonNode s : shots) {
            double d = s.path("durationSec").asDouble(0);
            if (!(d > 0) || d > 600) throw invalid("镜头时长须大于 0 秒");
            ObjectNode shot = out.addObject().put("id", s.hasNonNull("id") ? s.path("id").asText() : nextId(c, "sh"))
                    .put("durationSec", d).put("startSec", t).put("endSec", t + d)
                    .put("size", limited(s.path("size").asText(), 40, "景别"))
                    .put("camera", limited(s.path("camera").asText(), SHOT_TEXT_MAX, "机位与构图"))
                    .put("action", limited(s.path("action").asText(), SHOT_TEXT_MAX, "动作"))
                    .put("still", limited(s.path("still").asText(), SHOT_TEXT_MAX, "分镜画面"));
            ArrayNode dialogue = shot.putArray("dialogue");
            for (JsonNode line : s.path("dialogue")) {
                String text = line.path("text").asText("");
                if (text.isBlank()) continue;
                ObjectNode l = dialogue.addObject();
                String sp = line.path("speakerId").asText(null);
                if (sp == null || sp.isBlank()) l.putNull("speakerId"); else l.put("speakerId", sp);
                l.put("text", limited(text, SHOT_TEXT_MAX, "台词"));
            }
            t += d;
        }
        clip.set("shots", out);
        clip.put("durationSec", Math.round(t * 10) / 10.0);
    }

    private ObjectNode addCandidate(ObjectNode c, ObjectNode slot, String key, String runId, String source) {
        for (JsonNode m : slot.path("candidates")) if (key.equals(m.path("key").asText())) return (ObjectNode) m;
        ObjectNode m = ((ArrayNode) slot.path("candidates")).addObject().put("id", nextId(c, "m")).put("key", key)
                .put("source", source).put("createdAt", Instant.now().toString());
        if (runId != null) m.put("runId", runId); else m.putNull("runId");
        slot.putNull("error");
        return m;
    }

    private void adopt(ObjectNode target, String slotName, String candidateId) {
        ObjectNode slot = (ObjectNode) target.path(slotName);
        for (JsonNode m : slot.path("candidates")) if (m.path("id").asText().equals(candidateId)) {
            slot.put("adoptedId", candidateId).put("adoptedBy", "user");
            return;
        }
        throw BusinessException.notFound("DIRECTOR_CANDIDATE_NOT_FOUND", "该版本不存在，请刷新");
    }

    private static String adoptedKey(JsonNode slot) {
        String id = slot.path("adoptedId").asText(null);
        if (id == null) return null;
        for (JsonNode m : slot.path("candidates")) if (id.equals(m.path("id").asText())) return m.path("key").asText(null);
        return null;
    }

    private static boolean hasMedia(JsonNode clip) {
        return clip.path("board").path("candidates").size() > 0 || clip.path("video").path("candidates").size() > 0
                || clip.path("video").path("pending").size() > 0;
    }

    private void setError(ObjectNode c, String node, String message) {
        ObjectNode err = om.createObjectNode().put("message", message).put("at", Instant.now().toString());
        if (node.startsWith("asset:")) { JsonNode a = findOrNull(c, "assets", node.substring(6)); if (a != null) ((ObjectNode) a.path("image")).set("error", err); }
        else if (node.startsWith("board:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("board")).set("error", err); }
        else if (node.startsWith("video:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("video")).set("error", err); }
        else if (node.startsWith(REWRITE_NODE)) { JsonNode cl = findOrNull(c, "clips", node.substring(REWRITE_NODE.length())); if (cl != null) ((ObjectNode) cl.path("video")).set("error", err); }
        else if (node.startsWith("plan:")) { JsonNode ep = findOrNull(c, "episodes", node.substring(5)); if (ep != null) ((ObjectNode) ep).set("planError", err); }
        else c.set("textError", err.put("task", node.contains(":") ? node.substring(0, node.indexOf(':')) : node));
    }

    private void clearError(ObjectNode c, String node) {
        if (node.startsWith("asset:")) { JsonNode a = findOrNull(c, "assets", node.substring(6)); if (a != null) ((ObjectNode) a.path("image")).putNull("error"); }
        else if (node.startsWith("board:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("board")).putNull("error"); }
        else if (node.startsWith("video:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("video")).putNull("error"); }
        else if (node.startsWith(REWRITE_NODE)) { JsonNode cl = findOrNull(c, "clips", node.substring(REWRITE_NODE.length())); if (cl != null) ((ObjectNode) cl.path("video")).putNull("error"); }
        else if (node.startsWith("plan:")) { JsonNode ep = findOrNull(c, "episodes", node.substring(5)); if (ep != null) ((ObjectNode) ep).putNull("planError"); }
        else c.putNull("textError");
    }

    private void notice(ObjectNode c, String message) {
        c.putObject("notice").put("message", message).put("at", Instant.now().toString());
    }

    private boolean hasClips(ObjectNode c, String episodeId) {
        for (JsonNode clip : c.path("clips")) if (episodeId.equals(clip.path("episodeId").asText())) return true;
        return false;
    }

    /** 剧本现状的指纹：整份草稿、各集正文与修订号、片段列表。重新生成回来时比对它，变了就不替换。 */
    private String scriptBaseHash(ObjectNode c) {
        StringBuilder b = new StringBuilder(c.path("draft").asText()).append('|').append(c.path("draftRev").asLong());
        for (JsonNode ep : c.path("episodes")) b.append('|').append(ep.path("id").asText()).append(':').append(ep.path("rev").asLong()).append(':').append(hash(ep.path("content").asText()));
        for (JsonNode clip : c.path("clips")) b.append('|').append(clip.path("id").asText()).append(':').append(clip.path("rev").asLong());
        return hash(b.toString());
    }

    /** 提取结果对上已有资产：先认模型给的 existingId，再认同类同名。 */
    private JsonNode matchAsset(ObjectNode c, String existingId, String kind, String name) {
        if (existingId != null && !existingId.isBlank()) { JsonNode hit = findOrNull(c, "assets", existingId); if (hit != null) return hit; }
        for (JsonNode x : c.path("assets")) if (x.path("kind").asText().equals(kind) && x.path("name").asText().equals(name)) return x;
        for (JsonNode x : c.path("assets")) if (x.path("kind").asText().equals(kind) && ids(x.path("aliases")).contains(name)) return x;
        return null;
    }

    /**
     * 把作品里的一项资产关联到个人资产库的一项：记下 libraryObjectId，所选版本的图（角色没有图时用资产库的形象参考）
     * 直接作为采用的参考图（source=library，不会因设置改动过期），描述空着时补上。名字保留剧本里的叫法，提示词照它写。
     */
    void linkLibrary(String userId, ObjectNode c, ObjectNode target, IpLibraryDtos.LibraryObject o, String versionId) {
        String kind = target.path("kind").asText();
        if (!kind.equals(o.kind()))
            throw invalid("「" + o.name() + "」是" + KIND_NAMES.getOrDefault(o.kind(), "其他资产") + "，不能关联到" + KIND_NAMES.get(kind) + "「" + target.path("name").asText() + "」");
        IpLibraryDtos.LibraryVersion version = null;
        if (versionId != null && !versionId.isBlank()) {
            for (IpLibraryDtos.LibraryVersion v : o.versions()) if (versionId.equals(v.id())) version = v;
            if (version == null) throw BusinessException.notFound("DIRECTOR_LIBRARY_VERSION_NOT_FOUND", "「" + o.name() + "」的这一版图片已不存在，请刷新资产库后重选");
        } else for (IpLibraryDtos.LibraryVersion v : o.versions()) if (v.id().equals(o.mainVersionId())) version = v;
        String key = projects.requireOwnedAssetKey(userId, version == null ? null : version.storageKey());
        if (key == null && "character".equals(kind)) key = projects.requireOwnedAssetKey(userId, o.referenceKey());
        if (key == null) throw invalid("「" + o.name() + "」在资产库里还没有图片，请换一项");
        String description = o.description() == null ? "" : o.description().trim();
        if (target.path("description").asText().isBlank() && !description.isEmpty()) target.put("description", limited(description, 2000, "描述"));
        target.put("libraryObjectId", o.id());
        ObjectNode m = addCandidate(c, (ObjectNode) target.path("image"), key, null, "library");
        // 同一张图以前作为生成图进过历史时 addCandidate 返回旧候选：用户点名它就是资产库那一项，按资产库图处理，不再按生成指纹判过期。
        m.put("source", "library"); m.remove("stale"); m.remove("fingerprint");
        adopt(target, "image", m.path("id").asText());
        bump(target); // 描述可能被补上；不递增的话，拿着旧 rev 的页面能把它悄悄清掉
    }

    private static final Map<String, String> KIND_NAMES = Map.of("character", "角色", "scene", "场景", "prop", "道具");

    /** 资产出现在哪几集：只认作品里真有的集，按集的顺序存，去重；空数组表示不限定。 */
    private ArrayNode episodeIds(ObjectNode c, JsonNode in) {
        if (!in.isArray()) throw invalid("请选择出现的集");
        Set<String> wanted = new HashSet<>();
        for (JsonNode x : in) wanted.add(x.asText());
        ArrayNode out = om.createArrayNode();
        for (JsonNode ep : c.path("episodes")) if (wanted.remove(ep.path("id").asText())) out.add(ep.path("id").asText());
        if (!wanted.isEmpty()) throw invalid("选择的集已不存在，请刷新后重选");
        return out;
    }

    /** 只给提交后没改过正文的集打「已提取」：改过的集要按新正文再提取。返回正文改过的集。 */
    private List<String> markExtracted(ObjectNode c, JsonNode episodes) {
        List<String> changed = new ArrayList<>();
        for (JsonNode ep : episodes) {
            JsonNode e = findOrNull(c, "episodes", ep.path("id").asText());
            if (e == null) continue;
            if (hash(e.path("content").asText()).equals(ep.path("contentHash").asText())) ((ObjectNode) e).put("extracted", true);
            else changed.add("第 " + e.path("no").asInt() + " 集");
        }
        return changed;
    }

    /** 把用户在确认弹窗里勾选的项写进作品的资产：对上的合并别名和出现集，新的建资产。返回新建数。 */
    private int saveExtracted(ObjectNode c, JsonNode pending, JsonNode picks) {
        Map<String, JsonNode> chosen = new HashMap<>();
        for (JsonNode p : picks) if (p.path("include").asBoolean(true)) chosen.put(p.path("itemId").asText(), p);
        Map<Integer, String> epByNo = new HashMap<>();
        for (JsonNode ep : c.path("episodes")) epByNo.put(ep.path("no").asInt(), ep.path("id").asText());
        int added = 0;
        for (JsonNode a : pending.path("items")) {
            JsonNode pick = chosen.get(a.path("itemId").asText());
            if (pick == null) continue;
            String name = limited(pick.hasNonNull("name") ? pick.path("name").asText() : a.path("name").asText(), 40, "名称");
            if (name.isEmpty()) throw invalid("请填写资产名称");
            JsonNode hit = matchAsset(c, a.path("matchId").asText(null), a.path("kind").asText(), name);
            ObjectNode target;
            if (hit == null) {
                target = newAsset(c, a.path("kind").asText(), name, a.path("description").asText());
                ((ArrayNode) c.path("assets")).add(target);
                added++;
            } else {
                target = (ObjectNode) hit;
                if (target.path("description").asText().isBlank()) target.put("description", a.path("description").asText());
                // 对上已有资产、用户在弹窗里改了名：按新名字保存，原名留作别名。
                String old = target.path("name").asText();
                if (pick.hasNonNull("name") && !name.equals(old)) {
                    if (!ids(target.path("aliases")).contains(old)) ((ArrayNode) target.path("aliases")).add(old);
                    target.put("name", name);
                }
            }
            Set<String> aliases = ids(target.path("aliases"));
            for (JsonNode al : a.path("aliases")) if (aliases.add(al.asText())) ((ArrayNode) target.path("aliases")).add(al.asText());
            // 用户在弹窗里改了名：剧本里的原名记成别名，下次提取还能认出是同一个。
            String original = a.path("name").asText();
            if (!original.isBlank() && !original.equals(target.path("name").asText()) && aliases.add(original)) ((ArrayNode) target.path("aliases")).add(original);
            Set<String> eps = ids(target.path("episodeIds"));
            for (JsonNode n : a.path("episodeNos")) { String ep = epByNo.get(n.asInt()); if (ep != null && eps.add(ep)) ((ArrayNode) target.path("episodeIds")).add(ep); }
            bump(target);
        }
        return added;
    }

    /**
     * 用户最初的创意随分集、规划一起交给模型，让时长 / 集数 / 镜头数等要求一路生效；导入剧本没有创意就不放。
     * 有故事大纲时一并给（人物身份、主线），分集和提取对得上整体故事。
     */
    private static void putBrief(ObjectNode in, JsonNode c) {
        String idea = c.path("idea").asText();
        if (!idea.isBlank()) in.put("brief", idea);
        if (c.path("outline").isObject()) in.set("outline", c.path("outline"));
        putReference(in, c);
    }

    /** 用户随剧本提供的设定资料（拆分时从正文前面分出来的），作为创作材料给模型；太长只给前面一部分，作品里的原文不动。 */
    static final int REFERENCE_PROMPT_MAX = 12000;

    private static void putReference(ObjectNode in, JsonNode c) {
        String ref = c.path("reference").asText().strip();
        if (ref.isEmpty()) return;
        in.put("referenceNotes", ref.length() <= REFERENCE_PROMPT_MAX ? ref : ref.substring(0, REFERENCE_PROMPT_MAX) + "\n（设定资料较长，后面省略）");
    }

    private static long pixels(String size) {
        String[] wh = size.split("x");
        try { return Long.parseLong(wh[0].trim()) * Long.parseLong(wh[1].trim()); } catch (RuntimeException e) { return 0; }
    }

    private static boolean audioOnly(JsonNode a) { return a.path("description").asText("").contains("只出声音"); }

    private ObjectNode find(ObjectNode c, String list, String id, String label) {
        JsonNode n = findOrNull(c, list, id);
        if (n == null) throw BusinessException.notFound("DIRECTOR_TARGET_NOT_FOUND", label + "不存在，请刷新");
        return (ObjectNode) n;
    }

    private static JsonNode findOrNull(JsonNode c, String list, String id) {
        if (id == null) return null;
        for (JsonNode n : c.path(list)) if (id.equals(n.path("id").asText())) return n;
        return null;
    }

    private static void remove(ObjectNode c, String list, String id) {
        ArrayNode arr = (ArrayNode) c.path(list);
        for (int i = arr.size() - 1; i >= 0; i--) if (id.equals(arr.get(i).path("id").asText())) arr.remove(i);
    }

    private ObjectNode requireRev(ObjectNode target, Long rev) {
        if (rev == null || rev != target.path("rev").asLong()) throw conflict("该项已在其他页面修改");
        return target;
    }

    private static void bump(ObjectNode target) { target.put("rev", target.path("rev").asLong() + 1); }

    private static BusinessException conflict(String what) {
        return new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_EDIT_CONFLICT", what + "，请刷新后再修改");
    }

    private static BusinessException invalid(String message) {
        return BusinessException.badRequest("DIRECTOR_INPUT_INVALID", message);
    }

    /** 用户输入超长直接报错，不悄悄截断。 */
    private static String limited(String s, int max, String label) {
        String t = s == null ? "" : s.trim();
        if (t.length() > max) throw invalid(label + "不超过 " + max + " 字");
        return t;
    }

    private static Set<String> ids(JsonNode arr) {
        Set<String> out = new LinkedHashSet<>();
        arr.forEach(x -> out.add(x.isObject() ? x.path("id").asText() : x.asText()));
        return out;
    }

    private static boolean contains(JsonNode arr, String value) {
        for (JsonNode x : arr) if (value.equals(x.asText())) return true;
        return false;
    }

    private String nextId(ObjectNode c, String prefix) {
        long n = c.path("seq").asLong() + 1;
        c.put("seq", n);
        return prefix + n;
    }

    /** 段落：按换行切、去掉空行；拆集结果用段落区间回指原文，正文不经模型改写。 */
    static List<String> paragraphs(String text) {
        List<String> out = new ArrayList<>();
        for (String line : text.split("\\r?\\n")) if (!line.isBlank()) out.add(line.strip());
        return out;
    }

    /**
     * 只读接口用：不加行锁。MySQL 的只读事务里不能 SELECT … FOR UPDATE（H2 可以，本地看不出来），
     * 2026-10-25 线上报价 / 推荐预算 / 上传声音样本都因此 500。
     */
    private DirectorWork owned(String userId, String id) {
        DirectorWork w = works.findById(id).orElse(null);
        if (w == null || w.getDeletedAt() != null || !w.getOwnerUserId().equals(userId))
            throw BusinessException.notFound("DIRECTOR_WORK_NOT_FOUND", "作品不存在");
        return w;
    }

    private DirectorWork locked(String userId, String id) {
        DirectorWork w = works.lockById(id).orElse(null);
        if (w == null || w.getDeletedAt() != null || !w.getOwnerUserId().equals(userId))
            throw BusinessException.notFound("DIRECTOR_WORK_NOT_FOUND", "作品不存在");
        return w;
    }

    private void save(DirectorWork w, ObjectNode c) {
        w.setContentJson(write(c));
        w.setRevision(w.getRevision() + 1);
        w.setUpdatedAt(Instant.now());
        works.save(w);
    }

    private ObjectNode read(DirectorWork w) {
        try { return (ObjectNode) om.readTree(w.getContentJson()); }
        catch (Exception e) { throw new IllegalStateException("director content unreadable " + w.getId(), e); }
    }

    private JsonNode parse(String json) {
        try { return json == null ? om.createObjectNode() : om.readTree(json); } catch (Exception e) { return om.createObjectNode(); }
    }

    private String write(JsonNode n) {
        try { return om.writeValueAsString(n); } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static String fmt(double v) {
        return v == Math.floor(v) ? String.valueOf((int) v) : String.valueOf(Math.round(v * 10) / 10.0);
    }

    private static String shortTitle(String idea) {
        String t = idea.replaceAll("\\s+", " ").trim();
        return t.length() <= 20 ? t : t.substring(0, 20);
    }

    private static String firstLine(String s) {
        for (String line : s.split("\\r?\\n")) {
            String t = line.replaceAll("^#+\\s*", "").trim();
            if (!t.isEmpty()) return t.length() <= 20 ? t : t.substring(0, 20);
        }
        return "未命名作品";
    }

    static String hash(String s) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))).substring(0, 32); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
