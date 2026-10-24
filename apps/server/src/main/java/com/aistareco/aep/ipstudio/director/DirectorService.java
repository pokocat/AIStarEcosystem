package com.aistareco.aep.ipstudio.director;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
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
    private final ObjectMapper om;
    private final TransactionTemplate newTx;

    public DirectorService(DirectorWorkRepository works, IpRunRepository runs, IpProjectService projects, IpRunService imageRuns,
                           StudioWorkflowService textRuns, StudioWorkflowWorker workflowWorker, StudioVideoService videoModels,
                           StudioFixtureProvider fixtures, StudioMediaImportService mediaImport, MaterialVideoJobService videoJobs,
                           com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoClient,
                           com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies,
                           com.aistareco.aep.service.storage.FileStorageService storage,
                           com.aistareco.aep.ipstudio.config.IpStudioProperties studioProps,
                           ObjectMapper om, PlatformTransactionManager txManager) {
        this.works = works; this.runs = runs; this.projects = projects; this.imageRuns = imageRuns; this.textRuns = textRuns;
        this.workflowWorker = workflowWorker; this.videoModels = videoModels; this.fixtures = fixtures;
        this.mediaImport = mediaImport; this.videoJobs = videoJobs; this.videoClient = videoClient; this.scenePolicies = scenePolicies;
        this.storage = storage; this.studioProps = studioProps; this.om = om;
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
        c.putObject("settings").put("style", "真人写实").put("aspectRatio", "9:16").put("language", "中文").putNull("videoModel");
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
                ((ArrayNode) c.path("episodes")).add(newEpisode(c, 1, w.getTitle(), "", draft));
                c.put("draft", "").put("draftRev", c.path("draftRev").asLong() + 1);
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
                if (d.hasNonNull("episodeId")) ((ArrayNode) a.path("episodeIds")).add(d.path("episodeId").asText());
                ((ArrayNode) c.path("assets")).add(a);
            }
            case "asset.update" -> {
                ObjectNode a = requireRev(find(c, "assets", req.targetId(), "这个资产"), req.rev());
                if (d.has("name")) { String n = limited(d.path("name").asText(), 40, "名称"); if (!n.isEmpty()) a.put("name", n); }
                if (d.has("description")) a.put("description", limited(d.path("description").asText(), 2000, "描述"));
                // 角色音色的文字描述：没有参考音频时视频按它配音，有参考音频时作补充。
                if (d.has("voiceDesc")) a.put("voiceDesc", limited(d.path("voiceDesc").asText(), 200, "音色描述"));
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
                ObjectNode a = find(c, "assets", req.targetId(), "这个资产");
                String cid = d.path("candidateId").asText();
                // 之前上传进角色图历史的照片不能再采用，只能当形象参考。
                if ("character".equals(a.path("kind").asText()))
                    for (JsonNode m : a.path("image").path("candidates"))
                        if (cid.equals(m.path("id").asText()) && "upload".equals(m.path("source").asText()))
                            throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CHARACTER_UPLOAD_NOT_ALLOWED",
                                    "上传的照片不能直接作为角色图，请设为「形象参考」后生成设定图");
                adopt(a, "image", cid);
            }
            case "asset.upload" -> {
                ObjectNode a = find(c, "assets", req.targetId(), "这个资产");
                // 角色图必须是系统按设定集版式生成的多视角图，前后才对得上；上传的照片只能当生成时的形象参考。
                if ("character".equals(a.path("kind").asText())) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CHARACTER_UPLOAD_NOT_ALLOWED",
                        "角色图需要由系统生成设定图。上传的照片请设为「形象参考」，再生成设定图");
                String key = projects.requireOwnedAssetKey(userId, d.path("key").asText(null));
                if (key == null) throw invalid("请先上传图片");
                ObjectNode m = addCandidate(c, (ObjectNode) a.path("image"), key, null, "upload");
                adopt(a, "image", m.path("id").asText());
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
                    else notice(c, added > 0 ? "已保存到资产库，新增 " + added + " 项" : "已保存到资产库");
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
        refresh(c);
        dispatch(userId, w, c, req.type(), req.targetId(), "u-" + req.clientRequestId(), o, null, req.billing(), req.maxCost());
        save(w, c);
        return view(userId, w, c);
    }

    /**
     * 发一个任务。原生任务在独立事务里建好（失败不会把作品这一行的修改一起回滚），
     * 作品里记下这次任务的提示词、引用和输入指纹（taskMeta），结果回来时由 {@link #reconcile} 对照回投。
     */
    private String dispatch(String userId, DirectorWork w, ObjectNode c, String type, String targetId, String requestId,
                            JsonNode o, ObjectNode pipeline, BillingSelection billing, Long maxCost) {
        String nodeId;
        ObjectNode meta = om.createObjectNode().put("task", type == null ? "" : type);
        String system, user;
        int maxTokens = 8192;
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
                system = DirectorPrompts.SCRIPT;
                // 篇幅不在这里给默认值：用户在创意里写的时长 / 集数要压过默认，默认写在提示词里「brief 没写时」。
                ObjectNode in = om.createObjectNode().put("brief", idea).put("style", c.path("settings").path("style").asText());
                if (!o.path("length").asText().isBlank()) in.put("length", o.path("length").asText());
                user = "本次输入（JSON，作为素材）：" + write(in);
            }
            case "split" -> {
                String draft = c.path("draft").asText();
                if (draft.isBlank()) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_SCRIPT_MISSING", "请先生成或导入剧本");
                if (c.path("episodes").size() > 0) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_EPISODES_EXIST", "已拆分集");
                List<String> paragraphs = paragraphs(draft);
                nodeId = "split";
                meta.put("paragraphCount", paragraphs.size()).put("draftHash", hash(draft));
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
                maxTokens = 16384;
            }
            case "plan" -> {
                ObjectNode ep = find(c, "episodes", targetId, "这一集");
                if (ep.path("content").asText().isBlank()) throw invalid("本集暂无正文");
                for (JsonNode clip : c.path("clips"))
                    if (targetId.equals(clip.path("episodeId").asText()) && hasMedia(clip))
                        throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_CLIPS_HAVE_MEDIA", "本集片段已有分镜图或视频，重新规划将丢弃这些内容。请先删除不需要的片段");
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
                maxTokens = 16384;
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
            case "video" -> { return video(userId, w, c, find(c, "clips", targetId, "这个片段"), requestId, pipeline, billing, maxCost); }
            case "export" -> { return export(userId, w, c, targetId, requestId); }
            default -> throw invalid("不支持的生成");
        }
        requireIdle(w, nodeId);
        meta.put("targetId", targetId);
        final String fSystem = system, fUser = user, fNode = nodeId;
        final int fTokens = maxTokens;
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), fNode, fSystem, fUser, fTokens, requestId, meta, billing, maxCost));
        clearError(c, nodeId);
        track(c, pipeline, run.id(), om.createObjectNode().put("node", nodeId));
        w.setActive(true);
        return run.id();
    }

    private record Bound(String assetId, String name, String kind, String key, String label) {}

    /** 片段实际用到的参考图：角色 → 场景 → 道具，每个都要有已采用的图；缺了就报具体是哪个。 */
    private List<Bound> boundRefs(ObjectNode c, JsonNode clip, boolean requireConfirmed) {
        List<Bound> out = new ArrayList<>();
        List<String> missing = new ArrayList<>(), unconfirmed = new ArrayList<>();
        for (String kind : List.of("character", "scene", "prop")) {
            for (JsonNode idNode : clip.path("assetIds")) {
                JsonNode a = findOrNull(c, "assets", idNode.asText());
                if (a == null || !kind.equals(a.path("kind").asText()) || audioOnly(a)) continue;
                String key = adoptedKey(a.path("image"));
                if (key == null) { missing.add(a.path("name").asText()); continue; }
                if (requireConfirmed && "auto".equals(a.path("image").path("adoptedBy").asText())) unconfirmed.add(a.path("name").asText());
                out.add(new Bound(a.path("id").asText(), a.path("name").asText(), kind, key, "图" + (out.size() + 1)));
            }
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
        requireRefCapacity(refs.size());
        List<String> keys = new ArrayList<>();
        refs.forEach(r -> keys.add(r.key()));
        String runId;
        if (fixtures.enabled()) runId = newTx.execute(tx -> fixtureMedia(userId, w.getId(), nodeId, requestId, "image", prompt));
        else runId = newTx.execute(tx -> imageRuns.generateForDirector(userId, w.getId(),
                new IpRunService.IpGenerateRequest(nodeId, prompt, keys, 1, size, null, maxCost, billing, requestId)).id());
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
    private void requireRefCapacity(int count) {
        if (count == 0 || fixtures.enabled()) return;
        var endpoint = scenePolicies.resolve("studio", "image", null, 0).resolved().endpoint();
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

    private String videoFingerprintOrNull(ObjectNode c, JsonNode clip) {
        return videoCurrent(c, clip, limits(c)).fingerprint();
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
        return videoModels.quote(userId, in.request(null, null, null));
    }

    /** 片段里说台词、并且绑了声音的角色名。 */
    private List<String> voicedNames(ObjectNode c, JsonNode clip) {
        List<String> out = new ArrayList<>();
        for (JsonNode a : speakers(c, clip)) if (a.path("voice").path("key").isTextual()) out.add(a.path("name").asText());
        return out;
    }

    private String video(String userId, DirectorWork w, ObjectNode c, ObjectNode clip, String requestId, ObjectNode pipeline,
                         BillingSelection billing, Long maxCost) {
        String node = "video:" + clip.path("id").asText();
        requireIdle(w, node);
        if (clip.path("video").path("pending").size() > 0) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "该片段视频生成中，请稍候");
        VideoInput in = videoInput(c, clip);
        ObjectNode m = om.createObjectNode().put("node", node).put("prompt", in.prompt()).put("fingerprint", in.fingerprint());
        m.set("refs", in.refsMeta());
        clearError(c, node);
        w.setActive(true);
        if (fixtures.enabled()) {
            String runId = newTx.execute(tx -> fixtureMedia(userId, w.getId(), node, requestId, "video", in.prompt()));
            track(c, pipeline, runId, m);
            return runId;
        }
        JsonNode job = newTx.execute(tx -> imageRuns.generateVideoForDirector(userId, w.getId(), node, in.request(requestId, maxCost, billing)));
        String jobId = job.path("id").asText();
        ObjectNode entry = ((ObjectNode) clip.path("video")).withArray("pending").addObject().put("jobId", jobId).put("at", Instant.now().toString())
                .put("stage", job.path("stage").asText("已入队")).put("pct", job.path("progress_pct").asInt(0));
        entry.set("meta", m);
        if (pipeline != null) pipeline.withArray("videoJobs").addObject().put("jobId", jobId).put("estimate", maxCost == null ? 0 : maxCost);
        return jobId;
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
        String now = videoFingerprintOrNull(c, clip);
        boolean stale = !meta.hasNonNull("fingerprint") || !meta.path("fingerprint").asText().equals(now);
        ObjectNode m = addCandidate(c, slot, key, runId, "generated");
        if (meta.hasNonNull("fingerprint")) m.put("fingerprint", meta.path("fingerprint").asText());
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
        if (!runs.findByProjectIdAndNodeIdAndStatus(w.getId(), nodeId, IpRun.STATUS_RUNNING).isEmpty())
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
            try { apply(c, run); }
            catch (RuntimeException e) {
                log.warn("[director] 回投失败 work={} run={} reason={}", w.getId(), run.getId(), e.toString());
                setError(c, run.getNodeId(), "结果写入失败，请重新生成");
            }
            ((ArrayNode) c.path("applied")).add(run.getId());
            changed = true;
        }
        boolean[] videoRunning = {false};
        if (pollVideos(w, c, videoRunning)) changed = true;
        running |= videoRunning[0];
        if (changed) refresh(c);
        JsonNode p = c.path("pipeline");
        boolean active = running || p.isObject() && "running".equals(p.path("status").asText());
        if (active != w.isActive()) { w.setActive(active); changed = true; }
        return changed;
    }

    private void apply(ObjectNode c, IpRun run) {
        String node = run.getNodeId();
        if (node.startsWith("export:")) { applyExport(c, run, parse(run.getOutputJson())); return; }
        if (node.startsWith("video:") && "video.bound".equals(run.getStage())) return; // 真实视频由 pollVideos 跟踪原生任务
        if (IpRun.STATUS_FAILED.equals(run.getStatus())) {
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
                    history.insert(0, om.createObjectNode().put("at", Instant.now().toString()).put("logline", c.path("logline").asText()).put("draft", old.toString()));
                    while (history.size() > 3) history.remove(history.size() - 1);
                    c.putArray("episodes"); c.putArray("clips"); c.putNull("pendingExtract");
                    for (JsonNode a : c.path("assets")) ((ObjectNode) a).putArray("episodeIds");
                    c.put("draft", d.path("content").asText()).put("draftRev", c.path("draftRev").asLong() + 1);
                    if (!d.path("logline").asText().isBlank()) c.put("logline", d.path("logline").asText());
                    notice(c, "剧本已重新生成，旧版本保留在历史中；资产保留，请重新拆分并提取资产");
                    return;
                }
                if (!c.path("draft").asText().isBlank() || c.path("episodes").size() > 0 || c.path("draftRev").asLong() != in.path("draftRev").asLong()) {
                    notice(c, "生成期间剧本已有内容，新生成的剧本未覆盖"); return;
                }
                c.put("draft", d.path("content").asText()).put("draftRev", c.path("draftRev").asLong() + 1);
                if (!d.path("logline").asText().isBlank()) c.put("logline", d.path("logline").asText());
            }
            case "split" -> {
                String draft = c.path("draft").asText();
                if (c.path("episodes").size() > 0 || !hash(draft).equals(in.path("draftHash").asText())) {
                    notice(c, "拆分期间剧本有修改，本次结果未使用，请重新拆分"); return;
                }
                List<String> ps = paragraphs(draft);
                int no = 1;
                for (JsonNode e : d.path("episodes")) {
                    StringBuilder body = new StringBuilder();
                    for (int i = e.path("startParagraph").asInt(); i <= e.path("endParagraph").asInt() && i < ps.size(); i++) {
                        if (body.length() > 0) body.append("\n\n");
                        body.append(ps.get(i));
                    }
                    ((ArrayNode) c.path("episodes")).add(newEpisode(c, no++, e.path("title").asText(), e.path("summary").asText(), body.toString()));
                }
                c.put("draft", "").put("draftRev", c.path("draftRev").asLong() + 1);
            }
            case "extract" -> {
                // 提取结果先放进待确认清单：用户在弹窗里勾选、改名后才写进资产库，这里不改任何资产。
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
                    notice(c, "规划期间第 " + ep.path("no").asInt() + " 集正文有修改，本次结果未使用，请重新规划"); return;
                }
                // 规划期间用户改过本集片段（提示词、镜头、增删）：保留原片段，新计划留着让用户决定要不要换。
                boolean touched = !clipsHash(c, epId).equals(in.path("clipsHash").asText());
                boolean media = false;
                for (JsonNode clip : c.path("clips")) if (epId.equals(clip.path("episodeId").asText()) && hasMedia(clip)) media = true;
                if (touched || media) {
                    ObjectNode pending = ep.putObject("pendingPlan").put("runId", run.getId()).put("at", Instant.now().toString());
                    pending.set("clips", d.path("clips").deepCopy());
                    notice(c, "第 " + ep.path("no").asInt() + " 集片段在规划期间有修改，新计划未覆盖。可在「分镜」中选择替换");
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
        DirectorWork w = locked(userId, id);
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
        locked(userId, id);
        return mediaImport.upload(userId, file, "audio");
    }

    // ── 一键连跑 ─────────────────────────────────────────────────────────────

    public record PipelineRequest(String action, String scope, String episodeId, String target, Long budget, BillingSelection billing) {}

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
                String target = req.target() == null ? "board" : req.target();
                if (!Set.of("board", "video").contains(target)) throw invalid("一键制作仅支持到分镜图或片段视频");
                String scope = "work".equals(req.scope()) ? "work" : "episode";
                if ("video".equals(target) && "work".equals(scope)) throw invalid("整部作品仅支持制作到分镜图，视频请按集制作");
                if ("episode".equals(scope) && req.episodeId() != null) find(c, "episodes", req.episodeId(), "这一集");
                if (req.budget() == null || req.budget() <= 0) throw invalid("请设置预算上限");
                ObjectNode p = om.createObjectNode().put("id", "PL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                        .put("scope", scope).put("target", target).put("status", "running").put("stage", "starting")
                        .put("message", "启动中").put("budget", req.budget()).put("spent", 0).put("startedAt", Instant.now().toString());
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
            case "stop" -> requirePipeline(current).put("status", "stopped").put("message", "已停止，进行中的任务继续完成").put("finishedAt", Instant.now().toString());
            case "dismiss" -> c.putNull("pipeline");
            default -> throw invalid("不支持的操作");
        }
        reconcile(w, c);
        save(w, c);
        return view(userId, w, c);
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
        long spent = 0;
        int inflight = 0;
        Set<String> busy = new HashSet<>();
        for (JsonNode r : p.path("runIds")) {
            IpRun run = runs.findById(r.asText()).orElse(null);
            if (run == null) continue;
            spent += run.getCost();
            if (IpRun.STATUS_RUNNING.equals(run.getStatus())) { inflight++; busy.add(run.getNodeId()); }
        }
        for (JsonNode vj : p.path("videoJobs")) spent += vj.path("estimate").asLong();
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            for (JsonNode vj : p.path("videoJobs")) if (vj.path("jobId").asText().equals(pend.path("jobId").asText())) {
                inflight++; busy.add("video:" + clip.path("id").asText());
            }
        p.put("spent", spent);
        BillingSelection billing = p.hasNonNull("billing") ? om.convertValue(p.path("billing"), BillingSelection.class) : null;
        Step step = new Step(userId, w, c, p, spent, inflight, busy, textRuns.directorPrices(), billing);
        try {
            // 1. 剧本与分集
            if (c.path("episodes").isEmpty()) {
                if (c.path("draft").asText().isBlank()) {
                    if (c.path("idea").asText().isBlank()) { finish(p, "failed", "请先填写创意或导入剧本"); return; }
                    if (failed.contains("script")) { finish(p, "failed", "剧本生成失败，请在「剧本」中重试"); return; }
                    step.send("script", null, "剧本生成中"); return;
                }
                if (failed.contains("split")) { finish(p, "failed", "拆分失败，请在「剧本」中重试或作为一集"); return; }
                step.send("split", null, "拆分集中"); return;
            }
            List<JsonNode> eps = scopeEpisodes(c, p);
            // 2. 资产提取
            List<JsonNode> notExtracted = eps.stream().filter(e -> !e.path("extracted").asBoolean(false)).toList();
            if (c.path("pendingExtract").isObject()) {
                p.put("status", "waiting").put("stage", "confirm-extract").put("message", "资产已识别，请确认后保存到资产库");
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
                if (!step.send("plan", ep.path("id").asText(), "片段规划中")) return;
            }
            if (planning) return;
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
            if ("video".equals(p.path("target").asText())) {
                List<String> boardsToConfirm = new ArrayList<>();
                for (JsonNode clip : clipsOf(c, eps)) if ("auto".equals(clip.path("board").path("adoptedBy").asText())) boardsToConfirm.add("片段 " + clip.path("order").asInt());
                if (!boardsToConfirm.isEmpty()) {
                    p.put("status", "waiting").put("stage", "confirm-boards")
                            .put("message", "分镜图已生成（" + boardsToConfirm.size() + " 张），请在「分镜」中确认后继续");
                    return;
                }
                boolean videoing = false;
                for (JsonNode clip : clipsOf(c, eps)) {
                    String cid = clip.path("id").asText();
                    if (clip.path("video").path("pending").size() > 0) { videoing = true; continue; }
                    if (clip.path("video").path("candidates").size() > 0 || failed.contains("video:" + cid) || adoptedKey(clip.path("board")) == null) continue;
                    videoing = true;
                    if (!step.send("video", cid, "片段视频生成中")) return;
                }
                if (videoing) return;
            }
            int boards = 0, videos = 0;
            for (JsonNode clip : clipsOf(c, eps)) {
                if (clip.path("board").path("candidates").size() > 0) boards++;
                if (clip.path("video").path("candidates").size() > 0) videos++;
            }
            if ("video".equals(p.path("target").asText()) && failed.isEmpty()) {
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
                case "plan" -> "plan:" + target; case "extract" -> target == null ? "extract" : "extract:" + target; default -> type;
            };
            if (busy.contains(node)) { p.put("stage", stage).put("message", stage); return true; }
            long estimate = "video".equals(type) ? videoQuote(userId, c, findOrNull(c, "clips", target))
                    : Set.of("asset-image", "board").contains(type) ? prices[1] : prices[0];
            p.put("stage", stage).put("message", stage);
            if (inflight >= PIPELINE_INFLIGHT) return false;
            if (committed + estimate > p.path("budget").asLong()) {
                p.put("status", "waiting").put("stage", "budget").put("message",
                        "预算不足：已用 " + committed + " 积分，下一步约需 " + estimate + " 积分。提高预算后可继续");
                return false;
            }
            // 序号要数上已发出的所有任务：真实视频只记在 videoJobs、不进 runIds，漏数它会让重试沿用旧编号、被回放成上次失败的任务。
            // 发送中途出错（还没记下）时序号不变，同一请求照旧幂等回放。
            String requestId = p.path("id").asText() + "-" + node.replace(':', '-') + "-"
                    + (p.path("runIds").size() + p.path("videoJobs").size() + 1);
            dispatch(userId, w, c, type, target, requestId, om.createObjectNode(), p, billing, estimate);
            committed += estimate; inflight++; busy.add(node);
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

    // ── 出 wire ───────────────────────────────────────────────────────────────

    private JsonNode view(String userId, DirectorWork w, ObjectNode c) {
        ObjectNode v = c.deepCopy();
        v.remove("applied"); v.remove("taskMeta"); v.remove("seq");
        v.put("id", w.getId()).put("title", w.getTitle()).put("revision", w.getRevision())
                .put("createdAt", w.getCreatedAt().toString()).put("updatedAt", w.getUpdatedAt().toString());
        ArrayNode tasks = v.putArray("tasks");
        List<IpRun> mine = runs.findByProjectIdOrderByCreatedAtDesc(w.getId());
        for (IpRun r : mine.subList(0, Math.min(40, mine.size()))) {
            tasks.addObject().put("id", r.getId()).put("target", r.getNodeId()).put("status", r.getStatus())
                    .put("stage", r.getStage()).put("cost", r.getCost()).put("errorMessage", r.getErrorMessage())
                    .put("createdAt", r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
        }
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            tasks.insertObject(0).put("id", pend.path("jobId").asText()).put("target", "video:" + clip.path("id").asText()).put("status", "running")
                    .put("stage", pend.path("stage").asText()).put("cost", 0).putNull("errorMessage").put("createdAt", pend.path("at").asText());
        long[] prices = textRuns.directorPrices();
        v.putObject("pricing").put("textMax", prices[0]).put("image", prices[1]).put("mock", fixtures.enabled());
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

    /** 重新编译没被改写过的提示词，并按当前视频模型重算每个片段「需要修改」的问题。 */
    private void refresh(ObjectNode c) {
        Limits lim = limits(c);
        Map<String, String> names = new HashMap<>();
        Set<String> characters = new HashSet<>();
        for (JsonNode a : c.path("assets")) {
            if (!a.path("promptCustom").asBoolean(false)) ((ObjectNode) a).put("prompt", DirectorPrompts.assetPrompt(c.path("settings"), a));
            checkAsset((ObjectNode) a);
            names.put(a.path("id").asText(), a.path("name").asText());
            if ("character".equals(a.path("kind").asText())) characters.add(a.path("id").asText());
        }
        for (JsonNode clipNode : c.path("clips")) {
            ObjectNode clip = (ObjectNode) clipNode;
            List<DirectorPrompts.Ref> refs = new ArrayList<>();
            for (String kind : List.of("character", "scene", "prop"))
                for (JsonNode idNode : clip.path("assetIds")) {
                    JsonNode a = findOrNull(c, "assets", idNode.asText());
                    if (a == null || !kind.equals(a.path("kind").asText()) || audioOnly(a)) continue;
                    refs.add(new DirectorPrompts.Ref("图" + (refs.size() + 1), kind, a.path("name").asText()));
                }
            if (!clip.path("boardPromptCustom").asBoolean(false))
                clip.put("boardPrompt", DirectorPrompts.boardPrompt(c.path("settings"), clip, refs, names));
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
            ArrayNode unvoicedNode = clip.putArray("unvoiced");
            unvoiced.forEach(unvoicedNode::add);
            ArrayNode voicedNode = clip.putArray("voiced");
            voices.forEach(v -> voicedNode.add(v.name()));
            if (!clip.path("videoPromptCustom").asBoolean(false))
                clip.put("videoPrompt", lim != null && lim.frame() ? DirectorPrompts.framePrompt(c.path("settings"), clip, names, voiceDescs)
                        : DirectorPrompts.videoPrompt(c.path("settings"), clip, videoRefs, names, voices, unvoiced, voiceDescs));
            ArrayNode issues = clip.putArray("issues");
            int shots = clip.path("shots").size();
            if (shots == 0) issues.add("暂无镜头：请添加镜头或重新规划本集");
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
            check((ObjectNode) clip.path("board"), boardCurrent(c, clip), false);
            check((ObjectNode) clip.path("video"), videoCurrent(c, clip, lim), true);
        }
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
        String prompt = clip.path("videoPrompt").asText();
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
    private void check(ObjectNode slot, Current now, boolean video) {
        ArrayNode reasons = slot.putArray("staleReasons");
        JsonNode m = null;
        String id = slot.path("adoptedId").asText(null);
        for (JsonNode x : slot.path("candidates")) if (x.path("id").asText().equals(id)) m = x;
        if (m == null) { slot.putNull("adoptedCheck"); return; }
        if ("upload".equals(m.path("source").asText())) { slot.put("adoptedCheck", "current"); return; }
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
        if ("upload".equals(m.path("source").asText())) { slot.put("adoptedCheck", "current"); return; }
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

    private String sizeFor(ObjectNode c, String kind) {
        if ("prop".equals(kind)) return "1024x1024";
        if ("scene".equals(kind)) return "1365x768";
        if ("character".equals(kind)) return "1365x768"; // 角色设定集是横版排版
        return switch (c.path("settings").path("aspectRatio").asText("9:16")) { case "16:9" -> "1365x768"; case "1:1" -> "1024x1024"; default -> "768x1365"; };
    }

    // ── 内容小工具 ───────────────────────────────────────────────────────────

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
        else if (node.startsWith("plan:")) { JsonNode ep = findOrNull(c, "episodes", node.substring(5)); if (ep != null) ((ObjectNode) ep).set("planError", err); }
        else c.set("textError", err.put("task", node.contains(":") ? node.substring(0, node.indexOf(':')) : node));
    }

    private void clearError(ObjectNode c, String node) {
        if (node.startsWith("asset:")) { JsonNode a = findOrNull(c, "assets", node.substring(6)); if (a != null) ((ObjectNode) a.path("image")).putNull("error"); }
        else if (node.startsWith("board:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("board")).putNull("error"); }
        else if (node.startsWith("video:")) { JsonNode cl = findOrNull(c, "clips", node.substring(6)); if (cl != null) ((ObjectNode) cl.path("video")).putNull("error"); }
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

    /** 把用户在确认弹窗里勾选的项写进资产库：对上的合并别名和出现集，新的建资产。返回新建数。 */
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

    /** 用户最初的创意随分集、规划一起交给模型，让时长 / 集数 / 镜头数等要求一路生效；导入剧本没有创意就不放。 */
    private static void putBrief(ObjectNode in, JsonNode c) {
        String idea = c.path("idea").asText();
        if (!idea.isBlank()) in.put("brief", idea);
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
