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
    private final com.aistareco.aep.repository.MaterialVideoJobRepository videoJobRepo;
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
                           com.aistareco.aep.repository.MaterialVideoJobRepository videoJobRepo,
                           com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoClient,
                           com.aistareco.aep.service.AiAppSceneModelPolicyService scenePolicies,
                           com.aistareco.aep.service.storage.FileStorageService storage,
                           com.aistareco.aep.ipstudio.config.IpStudioProperties studioProps,
                           com.aistareco.aep.ipstudio.service.IpLibraryService library,
                           ObjectMapper om, PlatformTransactionManager txManager) {
        this.works = works; this.runs = runs; this.projects = projects; this.imageRuns = imageRuns; this.textRuns = textRuns;
        this.workflowWorker = workflowWorker; this.videoModels = videoModels; this.fixtures = fixtures;
        this.mediaImport = mediaImport; this.videoJobs = videoJobs; this.videoJobRepo = videoJobRepo; this.videoClient = videoClient; this.scenePolicies = scenePolicies;
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
        c.putObject("settings").put("style", "真人写实").put("aspectRatio", "9:16").put("language", "中文").putNull("videoModel").putNull("textModel");
        c.putArray("episodes"); c.putArray("assets"); c.putArray("clips"); c.putArray("applied");
        c.putObject("taskMeta"); c.putNull("pipeline"); c.putNull("notice"); c.putNull("textError");
        if (!idea.isEmpty() && script.isEmpty()) briefStore(c);
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
            if (in.has("textModel")) {
                String model = in.path("textModel").asText(null);
                textRuns.directorPrices(model); // 与展示、估价和提交使用相同的后台候选及售价。
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

    /**
     * 软删除。和提交任务、后台推进抢同一把作品行锁，拿到锁时之前派发的任务都已提交，查得到；
     * 删除提交后它们再拿锁都会看到 deletedAt，不再派发。
     * <p>在途检查和删除在同一个事务、同一条连接里做：持着作品行锁再去开 REQUIRES_NEW 要第二条连接，
     * 并发删除时每个请求都占着一条连接等另一条，连接池会被耗尽（2026-10-28 独立复核复现）。
     * 读已提交保证拿到锁之后的每条查询都看到最新提交的任务（MySQL 默认可重复读的快照可能更早，§8.0.1 ⑯）；
     * 已经在别的事务里调用时沿用外层事务（Spring 不改参与中事务的隔离级别），控制器直接调用时才生效。
     * <ul>
     *   <li>一键制作在跑：409，先停止；暂停 / 等待确认且没有在途任务：同一事务里标为停止再删除；</li>
     *   <li>有在途任务（以 ip_run 和原生视频任务为准，不信作品 JSON 和 active）：409，等任务结束；</li>
     *   <li>本人已删除：直接成功（超时重试）；不存在或不是本人的：404，不泄漏归属。</li>
     * </ul>
     * 作品 JSON、任务记录、资产库和账本都不动，不退款、不重提。
     */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void delete(String userId, String id) {
        DirectorWork w = works.lockById(id).orElse(null);
        if (w == null || !w.getOwnerUserId().equals(userId)) throw BusinessException.notFound("DIRECTOR_WORK_NOT_FOUND", "作品不存在");
        if (w.getDeletedAt() != null) return;
        ObjectNode c = read(w);
        JsonNode p = c.path("pipeline");
        String status = p.path("status").asText("");
        if (p.isObject() && "running".equals(status))
            throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_WORK_BUSY", "一键制作正在进行，请先停止制作，等进行中的任务结束后再删除");
        String busy = inFlight(w, c);
        if (busy != null) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_WORK_BUSY", busy);
        if (p.isObject() && Set.of("waiting", "paused").contains(status)) finish((ObjectNode) p, "stopped", "作品已删除，制作已停止");
        w.setDeletedAt(Instant.now()); w.setActive(false);
        save(w, c);
    }

    private static final Set<String> VIDEO_JOB_TERMINAL = Set.of("succeeded", "failed");

    /**
     * 作品还有没结束的任务就返回给用户看的原因，否则 null。在调用方的事务里查，只取标量列：
     * 不经过持久化上下文里的实体缓存，读到的就是这条语句执行时数据库里已提交的状态。
     * 真实视频的 ip_run 是 done / video.bound 的绑定记录，真正的状态在它指向的原生视频任务上。
     * 原生任务以 succeeded / failed 结案就算结束 —— 包括按全局规则以 failed 结案的 VIDEO_SUBMISSION_UNKNOWN
     * （冻结已释放，见 BUSINESS_RULES「模型任务异常状态与并发」）；还没结案的（排队、提交中、生成中、受理待核对、
     * 正在重新查询原任务）、查不到或不属本人的，都算没结束。
     */
    private String inFlight(DirectorWork w, ObjectNode c) {
        Set<String> jobIds = new LinkedHashSet<>();
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            if (pend.hasNonNull("jobId")) jobIds.add(pend.path("jobId").asText());
        for (Object[] r : runs.taskStates(w.getId())) {
            String status = (String) r[0], stage = (String) r[1], node = (String) r[2], input = (String) r[3];
            if (!IpRun.STATUS_DONE.equals(status) && !IpRun.STATUS_FAILED.equals(status))
                return taskLabel(node) + "正在进行，任务结束后再删除";
            if ("video.bound".equals(stage)) jobIds.addAll(IpProjectService.nativeVideoJobIds(parse(input)));
        }
        if (jobIds.isEmpty()) return null;
        Map<String, Object[]> jobs = new HashMap<>();
        for (Object[] j : videoJobRepo.states(jobIds)) jobs.put((String) j[0], j);
        for (String jobId : jobIds) {
            Object[] job = jobs.get(jobId);
            if (job == null || !w.getOwnerUserId().equals(job[3])) {
                log.warn("[director] 删除前核对视频任务失败 work={} job={}", w.getId(), jobId);
                return "片段视频的任务状态暂时无法确认，请稍后再试";
            }
            if (VIDEO_JOB_TERMINAL.contains((String) job[1])) continue;
            if ("VIDEO_SUBMISSION_UNKNOWN".equals(job[2]) || "VIDEO_RECONCILIATION_PENDING".equals(job[2]))
                return "片段视频的受理结果还在核对，核对完成后再删除";
            return "片段视频正在生成，任务结束后再删除";
        }
        return null;
    }

    private static String taskLabel(String node) {
        if (node == null) return "生成任务";
        if (node.equals("script")) return "剧本生成";
        if (node.equals("split")) return "拆分集";
        if (node.startsWith("extract")) return "资产提取";
        if (node.startsWith("plan:")) return "分镜脚本生成";
        if (node.startsWith("asset:")) return "资产参考图生成";
        if (node.startsWith("board:")) return "分镜图生成";
        if (node.startsWith("video:")) return "片段视频生成";
        if (node.startsWith("export:")) return "整集导出";
        if (node.equals("assistant")) return "创作助手回复";
        return "生成任务";
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
                        if (cid.equals(m.path("id").asText()) && Set.of("upload", "library").contains(m.path("source").asText()))
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
            case "asset.import" -> {
                // 从个人资产库导入：只收资产库对象的 id 和版本，名字、描述、图都由服务端按本人资产库读出来。
                // 带 targetId 是给已有资产换成资产库里的图（一次一项），否则按名字对上已有资产或新建。
                JsonNode items = d.path("items");
                if (items.size() == 0) throw invalid("请选择要导入的资产");
                if (items.size() > 16) throw invalid("一次最多导入 16 项");
                ObjectNode explicit = req.targetId() == null ? null : find(c, "assets", req.targetId(), "这个资产");
                if (explicit != null && items.size() != 1) throw invalid("请只选择一项资产");
                String episodeId = d.hasNonNull("episodeId") ? d.path("episodeId").asText() : null;
                for (JsonNode item : items) importFromLibrary(userId, c, explicit, library.object(userId, item.path("objectId").asText()),
                        item.path("versionId").asText(null), episodeId);
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
            case "assistant.apply", "assistant.dismiss", "assistant.undo" -> proposalOp(userId, w, c, req.op(), d);
            case "assistant.newThread" -> newThread(assistantStore(c));
            case "assistant.openThread" -> {
                ObjectNode store = assistantStore(c);
                String tid = d.path("threadId").asText();
                if (findOrNull(store, "threads", tid) == null) throw BusinessException.notFound("DIRECTOR_THREAD_NOT_FOUND", "这段对话不存在，请刷新");
                store.put("current", tid);
            }
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
        if ("assistant".equals(req.type())) askAssistant(userId, w, c, req, o);
        else if ("brief".equals(req.type())) askBrief(userId, w, c, req, o);
        else dispatch(userId, w, c, req.type(), req.targetId(), "u-" + req.clientRequestId(), o, null, req.billing(), req.maxCost());
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
                // 对话里定下的题材 / 调性：请求没另选时沿用
                if (!hasScript && c.path("brief").isObject()) for (String f : List.of("genre", "tone"))
                    if (!o.has(f) && !c.path("brief").path(f).asText().isBlank() && c.path(f).asText("").isBlank()) c.put(f, c.path("brief").path(f).asText());
                system = DirectorPrompts.script(c.path("genre").asText(null), c.path("tone").asText(null));
                // 篇幅不在这里给默认值：用户在创意里写的时长 / 集数要压过默认，默认写在提示词里「brief 没写时」。
                // 带上写剧本前对话里确认过的回答和整理好的要求，不丢用户的选择。
                ObjectNode in = om.createObjectNode().put("brief", hasScript ? idea : briefForScript(c, o.path("skip").asBoolean(false)))
                        .put("style", c.path("settings").path("style").asText());
                if (!hasScript) {
                    ObjectNode b = briefStore(c);
                    if (!"writing".equals(b.path("status").asText())) b.put("prevStatus", b.path("status").asText());
                    b.put("status", "writing");
                }
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
                // 大纲里的人物年龄、身份给资产统筹参考，角色描述和故事对得上。
                if (c.path("outline").path("characters").isArray()) in.set("outlineCharacters", c.path("outline").path("characters"));
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
                maxTokens = 16384;
            }
            case "asset-image" -> {
                ObjectNode a = find(c, "assets", targetId, "这个资产");
                String prompt = a.path("prompt").asText();
                if (prompt.isBlank()) throw invalid("请先填写资产描述");
                String refKey = characterRefKey(a);
                List<Bound> refs = new ArrayList<>();
                if (refKey != null) refs.add(new Bound(targetId, a.path("name").asText() + "的形象参考", "character", refKey, "图1"));
                if (refKey != null) prompt = prompt + "\n" + DirectorPrompts.CHARACTER_REF_NOTE;
                String baseOn = o.path("baseOnCurrent").asBoolean(false) ? baseOnCurrent(a, "image", a.path("name").asText(), refs) : null;
                if (baseOn != null) prompt = prompt + "\n" + DirectorPrompts.baseOnNote(refs.get(refs.size() - 1).label());
                return image(userId, w, c, "asset:" + targetId, requestId, prompt, refs, sizeFor(c, a.path("kind").asText()),
                        assetFingerprint(a), pipeline, billing, maxCost, baseOn);
            }
            case "board" -> {
                ObjectNode clip = find(c, "clips", targetId, "这个片段");
                if (clip.path("issues").size() > 0) throw new BusinessException(HttpStatus.BAD_REQUEST, "DIRECTOR_CLIP_NEEDS_FIX",
                        "该片段需先修改：" + clip.path("issues").get(0).asText());
                List<Bound> refs = new ArrayList<>(boundRefs(c, clip, true));
                String prompt = clip.path("boardPrompt").asText();
                String baseOn = o.path("baseOnCurrent").asBoolean(false) ? baseOnCurrent(clip, "board", "片段 " + clip.path("order").asInt() + " 的分镜图", refs) : null;
                if (baseOn != null) prompt = prompt + "\n" + DirectorPrompts.baseOnNote(refs.get(refs.size() - 1).label());
                return image(userId, w, c, "board:" + targetId, requestId, prompt, refs, sizeFor(c, "board"),
                        boardCurrent(c, clip).fingerprint(), pipeline, billing, maxCost, baseOn);
            }
            case "video" -> { return video(userId, w, c, find(c, "clips", targetId, "这个片段"), requestId, pipeline, billing, maxCost); }
            case "export" -> { return export(userId, w, c, targetId, requestId); }
            default -> throw invalid("不支持的生成");
        }
        requireIdle(w, nodeId);
        meta.put("targetId", targetId);
        final String fSystem = system, fUser = user, fNode = nodeId;
        final int fTokens = maxTokens;
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), fNode, fSystem, fUser, fTokens, requestId, meta, c.path("settings").path("textModel").asText(null), billing, maxCost, null));
        clearError(c, nodeId);
        track(c, pipeline, run.id(), om.createObjectNode().put("node", nodeId));
        w.setActive(true);
        return run.id();
    }

    private record Bound(String assetId, String name, String kind, String key, String label) {}

    /** 片段实际用到的参考图：角色 → 场景 → 道具，每个都要有已采用的图；缺了就报具体是哪个。 */
    /**
     * 分镜节奏的程序检查（不靠模型自检）：镜头数、单镜时长、相邻景别、片段时长，规则同「写分镜脚本」提示词。
     * 只是提示，不进 issues、不拦截出图，也不自动重写；只按首帧出片的模型一段一个镜头，不查。
     */
    private ArrayNode shotWarnings(JsonNode clip, Limits lim, double total, int lastOrderInEpisode) {
        ArrayNode out = om.createArrayNode();
        JsonNode shots = clip.path("shots");
        if (lim == null || lim.frame() || shots.isEmpty()) return out;
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

    /** 「围绕当前图修改」：把当前采用的那张追加为最后一张参考图，返回它的版本 id。 */
    private String baseOnCurrent(JsonNode target, String slotName, String name, List<Bound> refs) {
        JsonNode slot = target.path(slotName);
        String key = adoptedKey(slot);
        if (key == null) throw invalid("还没有采用的图，不能围绕当前图修改");
        refs.add(new Bound(target.path("id").asText(), name + "（当前版本）", "board".equals(slotName) ? "board" : target.path("kind").asText(), key, "图" + (refs.size() + 1)));
        return slot.path("adoptedId").asText();
    }

    private String image(String userId, DirectorWork w, ObjectNode c, String nodeId, String requestId, String prompt,
                         List<Bound> refs, String size, String fingerprint, ObjectNode pipeline, BillingSelection billing, Long maxCost, String baseOn) {
        requireIdle(w, nodeId);
        requireRefCapacity(refs.size());
        List<String> keys = new ArrayList<>();
        refs.forEach(r -> keys.add(r.key()));
        String runId;
        if (fixtures.enabled()) runId = newTx.execute(tx -> fixtureMedia(userId, w.getId(), nodeId, requestId, "image", prompt));
        else runId = newTx.execute(tx -> imageRuns.generateForDirector(userId, w.getId(),
                new IpRunService.IpGenerateRequest(nodeId, prompt, keys, 1, size, null, maxCost, billing, requestId)).id());
        ObjectNode m = om.createObjectNode().put("node", nodeId).put("prompt", prompt).put("fingerprint", fingerprint);
        if (baseOn != null) m.put("baseOn", baseOn);
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
            try { apply(w, c, run); }
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

    private void apply(DirectorWork w, ObjectNode c, IpRun run) {
        String node = run.getNodeId();
        if ("assistant".equals(node)) { applyAssistantReply(c, run); return; }
        if ("brief".equals(node)) { applyBriefReply(c, run); return; }
        if ("script".equals(node) && c.path("brief").isObject()) {
            ObjectNode b = (ObjectNode) c.path("brief");
            if ("writing".equals(b.path("status").asText()))
                b.put("status", IpRun.STATUS_FAILED.equals(run.getStatus()) ? b.path("prevStatus").asText("ready") : "done");
        }
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
                if (meta.hasNonNull("baseOn")) m.put("baseOn", meta.path("baseOn").asText());
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
                    history.insert(0, om.createObjectNode().put("title", w.getTitle()).put("at", Instant.now().toString()).put("logline", c.path("logline").asText()).put("draft", old.toString())
                            .set("outline", c.path("outline").isObject() ? c.path("outline") : om.nullNode()));
                    while (history.size() > 3) history.remove(history.size() - 1);
                    c.putArray("episodes"); c.putArray("clips"); c.putNull("pendingExtract");
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
            // 片段在正文里从哪句开始：剧本预览据此定位；找不到就不记，不伪造位置。
            String quote = p.path("sourceQuote").asText("");
            if (!quote.isBlank() && DirectorAssistant.locate(ep.path("content").asText(), quote) != null) clip.put("sourceQuote", quote);
            setShots(c, clip, p.path("shots"), false);
            clips.add(clip);
        }
        renumber(c, epId);
        ep.put("planStale", false);
        ep.putNull("pendingPlan");
    }

    // ── 写剧本前的创意对话（docs/ai-director-assistant.md §7）────────────────
    //
    // 有剧本之前，剧本页默认是一段有限的澄清对话：AI 最多问 MAX_BRIEF_ROUNDS 轮，每轮最多两个问题；
    // 信息够了或到上限就整理成创作要求，用户确认后写剧本。任何时候都能跳过，直接用已有信息生成。
    // 一轮是一次导演台文字任务（节点 brief），计费、幂等、测试响应同 submitDirectorText。

    private ObjectNode briefStore(ObjectNode c) {
        if (!c.path("brief").isObject()) {
            ObjectNode b = c.putObject("brief").put("status", "asking").put("rounds", 0).put("maxRounds", DirectorAssistant.MAX_BRIEF_ROUNDS)
                    .put("summary", "").put("genre", "").put("tone", "").put("title", "");
            b.putArray("messages");
        }
        return (ObjectNode) c.path("brief");
    }

    private boolean hasScript(ObjectNode c) {
        return !c.path("draft").asText().isBlank() || c.path("episodes").size() > 0;
    }

    private void askBrief(String userId, DirectorWork w, ObjectNode c, TaskRequest req, JsonNode o) {
        if (hasScript(c)) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SCRIPT_EXISTS", "已有剧本，可以在助手里继续讨论和修改");
        ObjectNode b = briefStore(c);
        String clientId = req.clientRequestId();
        for (JsonNode m : b.path("messages")) if (clientId.equals(m.path("clientId").asText(null))) return; // 同一编号重发：已受理
        if ("writing".equals(b.path("status").asText())) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "剧本正在写，请稍候");
        if (c.path("idea").asText().isBlank()) throw invalid("请先写下你的想法");
        String text = o.path("message").asText("").trim();
        if (text.length() > DirectorAssistant.MAX_MESSAGE) throw invalid("一次最多 " + DirectorAssistant.MAX_MESSAGE + " 字");
        ArrayNode msgs = (ArrayNode) b.path("messages");
        boolean opening = text.isEmpty();
        if (opening && msgs.size() > 0) throw invalid("请输入回答");
        requireIdle(w, "brief");
        String now = Instant.now().toString();
        // 用户说「你决定 / 直接写」：不再问，直接按已有信息写剧本（同一个请求编号，重发不会写两份）。
        if (!opening && DirectorAssistant.saysGo(text)) {
            dispatch(userId, w, c, "script", null, "u-" + clientId, om.createObjectNode().put("skip", true), null, req.billing(), req.maxCost());
            msgs.addObject().put("id", "b" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)).put("clientId", clientId)
                    .put("role", "user").put("text", text).put("at", now).put("status", "done");
            return;
        }
        int rounds = b.path("rounds").asInt();
        boolean mustConclude = rounds >= DirectorAssistant.MAX_BRIEF_ROUNDS;
        ObjectNode material = om.createObjectNode().put("idea", c.path("idea").asText()).put("roundsUsed", rounds)
                .put("roundsLeft", Math.max(0, DirectorAssistant.MAX_BRIEF_ROUNDS - rounds - 1)).put("mustConclude", mustConclude);
        material.set("genres", om.valueToTree(DirectorPrompts.GENRES.keySet()));
        material.set("tones", om.valueToTree(DirectorPrompts.TONES.keySet()));
        material.set("conversation", briefTranscript(b));
        ObjectNode meta = om.createObjectNode().put("task", "brief").put("mustConclude", mustConclude);
        String messageId = "b" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        meta.put("messageId", messageId).put("round", rounds + 1).put("message", DirectorPrompts.clip(text, 400));
        String user = "本次输入（JSON，作为素材）：" + write(material) + (opening ? "\n\n这是第一轮：请看用户的想法，判断要不要问、问什么。" : "\n\n用户这次说（这是用户的回答）：" + text);
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), "brief", DirectorAssistant.BRIEF_SYSTEM, user, 2048, "u-" + clientId, meta,
                c.path("settings").path("textModel").asText(null), req.billing(), req.maxCost(), null));
        track(c, null, run.id(), om.createObjectNode().put("node", "brief"));
        if (!opening) msgs.addObject().put("id", "b" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)).put("clientId", clientId)
                .put("role", "user").put("text", text).put("at", now).put("status", "done");
        else meta.put("clientId", clientId);
        ObjectNode am = msgs.addObject().put("id", messageId).put("role", "assistant").put("text", "").put("at", now).put("status", "pending").put("runId", run.id());
        if (opening) am.put("clientId", clientId);
        am.putArray("questions");
        b.put("status", "asking");
        w.setActive(true);
    }

    /** 对话记录（给模型和写剧本用）：问题、选项、用户的回答，按顺序。 */
    private ArrayNode briefTranscript(JsonNode b) {
        ArrayNode out = om.createArrayNode();
        for (JsonNode m : b.path("messages")) {
            if (!"done".equals(m.path("status").asText())) continue;
            if ("user".equals(m.path("role").asText())) { out.addObject().put("user", m.path("text").asText()); continue; }
            ObjectNode a = out.addObject().put("ai", m.path("text").asText());
            ArrayNode qs = a.putArray("asked");
            for (JsonNode q : m.path("questions")) qs.add(q.path("q").asText());
        }
        return out;
    }

    private void applyBriefReply(ObjectNode c, IpRun run) {
        ObjectNode b = briefStore(c);
        JsonNode meta = parse(run.getInputJson()).path("_director");
        ObjectNode msg = null;
        for (JsonNode m : b.path("messages")) if (m.path("id").asText().equals(meta.path("messageId").asText())) msg = (ObjectNode) m;
        if (msg == null) return;
        if (IpRun.STATUS_FAILED.equals(run.getStatus())) {
            msg.put("status", "failed").put("error", run.getErrorMessage() == null ? "这一轮没有回复成功，请重新发送，或直接生成剧本" : run.getErrorMessage());
            return;
        }
        JsonNode d = parse(run.getOutputJson()).path("director");
        msg.put("status", "done").put("text", d.path("reply").asText());
        msg.set("questions", d.path("questions").deepCopy());
        if (d.path("questions").size() > 0) b.put("rounds", b.path("rounds").asInt() + 1);
        for (String f : List.of("summary", "genre", "tone", "title")) if (!d.path(f).asText().isBlank()) b.put(f, d.path(f).asText());
        // 回复晚到时剧本可能已经在写或写完了（用户中途跳过），这时只记下对话，不改状态。
        if (d.path("ready").asBoolean(false) && "asking".equals(b.path("status").asText())) b.put("status", "ready");
    }

    /** 写剧本用的完整要求：原始想法 + 对话里确认过的回答 + 整理好的要求；跳过时说明其余由 AI 补齐。 */
    private String briefForScript(ObjectNode c, boolean skip) {
        StringBuilder s = new StringBuilder(c.path("idea").asText());
        JsonNode b = c.path("brief");
        ArrayNode qa = b.isObject() ? briefTranscript(b) : om.createArrayNode();
        boolean answered = false;
        for (JsonNode x : qa) if (x.has("user")) answered = true;
        if (answered) {
            s.append("\n\n【写剧本前和用户确认过的内容（用户的回答必须照做）】");
            for (JsonNode x : qa) {
                if (x.has("ai") && x.path("asked").size() > 0) s.append("\n问：").append(String.join(" / ", DirectorPrompts.strings(x.path("asked"))));
                if (x.has("user")) s.append("\n答：").append(x.path("user").asText());
            }
        }
        if (b.isObject() && !b.path("summary").asText().isBlank()) s.append("\n\n【整理后的创作要求】\n").append(b.path("summary").asText());
        if (skip) s.append("\n\n用户选择不再回答问题：上面没说清的，由你按最适合这个故事的方式补齐，直接写。");
        return s.toString();
    }

    // ── 全能创作助手（docs/ai-director-assistant.md）────────────────────────
    //
    // 一部作品一份对话（可分段），每条消息绑定发送时的对象（scope）。助手回复是一次普通的导演台文字任务（节点 assistant，
    // 同一部作品同时只有一条在回复），计费、幂等、测试响应都走 submitDirectorText。回复里的建议只是建议：
    // 用户点「采用」才写入，写入前按原文 / 修订号核对，之后改过的内容不会被覆盖；采用后能撤销。

    static final int MAX_THREADS = 12;
    static final int MAX_THREAD_MESSAGES = 200;

    private ObjectNode assistantStore(ObjectNode c) {
        if (!c.path("assistant").isObject()) {
            ObjectNode a = c.putObject("assistant");
            a.putNull("current"); a.putArray("threads");
        }
        return (ObjectNode) c.path("assistant");
    }

    private ObjectNode newThread(ObjectNode store) {
        ObjectNode cur = (ObjectNode) findOrNull(store, "threads", store.path("current").asText(null));
        if (cur != null && cur.path("messages").isEmpty()) return cur; // 当前这段还是空的就直接用
        String now = Instant.now().toString();
        ObjectNode t = om.createObjectNode().put("id", "th" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .put("title", "").put("createdAt", now).put("updatedAt", now);
        t.putArray("messages");
        ArrayNode threads = (ArrayNode) store.path("threads");
        threads.insert(0, t);
        while (threads.size() > MAX_THREADS) threads.remove(threads.size() - 1);
        store.put("current", t.path("id").asText());
        return t;
    }

    private ObjectNode currentThread(ObjectNode store, String threadId) {
        String id = threadId != null && !threadId.isBlank() ? threadId : store.path("current").asText(null);
        ObjectNode t = (ObjectNode) findOrNull(store, "threads", id);
        if (t == null) t = newThread(store);
        store.put("current", t.path("id").asText());
        return t;
    }

    /** 按 id 或客户端编号找消息（跨全部对话段）。返回 [thread, message]。 */
    private ObjectNode[] findMessage(ObjectNode c, String field, String value) {
        if (value == null || value.isBlank()) return null;
        for (JsonNode t : c.path("assistant").path("threads"))
            for (JsonNode m : t.path("messages")) if (value.equals(m.path(field).asText(null))) return new ObjectNode[]{(ObjectNode) t, (ObjectNode) m};
        return null;
    }

    private void askAssistant(String userId, DirectorWork w, ObjectNode c, TaskRequest req, JsonNode o) {
        String clientId = req.clientRequestId();
        // 同一发送编号重发（上次超时、回包丢了）：消息已经在了就直接返回，不再建任务、不重复扣费。
        if (findMessage(c, "clientId", clientId) != null) return;
        String text = o.path("message").asText("").trim();
        if (text.isEmpty()) throw invalid("请输入想和助手说的话");
        if (text.length() > DirectorAssistant.MAX_MESSAGE) throw invalid("一次最多 " + DirectorAssistant.MAX_MESSAGE + " 字");
        requireIdle(w, "assistant");
        ObjectNode scope = resolveScope(c, w, o.path("scope"));
        ObjectNode store = assistantStore(c);
        ObjectNode thread = currentThread(store, o.path("threadId").asText(null));
        if (thread.path("messages").size() >= MAX_THREAD_MESSAGES) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_THREAD_FULL", "这段对话太长了，请开一段新对话");

        String kind = scope.path("kind").asText();
        boolean hasScript = !c.path("draft").asText().isBlank() || c.path("episodes").size() > 0;
        List<String> allowed = DirectorAssistant.allowed(kind, hasScript, c.path("episodes").size() > 0);
        ObjectNode meta = om.createObjectNode().put("task", "assistant").put("threadId", thread.path("id").asText());
        meta.set("allowed", om.valueToTree(allowed));
        ArrayNode targets = meta.putArray("scriptTargets"), clipIds = meta.putArray("clipIds"), assetIds = meta.putArray("assetIds"), which = meta.putArray("which");
        ObjectNode before = meta.putObject("before");
        ObjectNode material = om.createObjectNode();
        ObjectNode workInfo = material.putObject("work").put("title", w.getTitle()).put("idea", c.path("idea").asText())
                .put("genre", c.path("genre").asText("")).put("tone", c.path("tone").asText("")).put("logline", c.path("logline").asText())
                .put("style", c.path("settings").path("style").asText()).put("aspectRatio", c.path("settings").path("aspectRatio").asText());
        if (c.path("outline").isObject()) workInfo.set("outline", c.path("outline"));
        ArrayNode eps = material.putArray("episodes");
        for (JsonNode ep : c.path("episodes")) eps.addObject().put("id", ep.path("id").asText()).put("no", ep.path("no").asInt())
                .put("title", ep.path("title").asText()).put("summary", ep.path("summary").asText());
        ArrayNode as = material.putArray("assets");
        for (JsonNode a : c.path("assets")) if (as.size() < 60) as.addObject().put("id", a.path("id").asText()).put("kind", a.path("kind").asText())
                .put("name", a.path("name").asText()).put("description", DirectorPrompts.clip(a.path("description").asText(), 300));

        ObjectNode focus = material.putObject("focus").put("kind", kind).put("label", scope.path("label").asText());
        String epId = scope.path("episodeId").asText(null);
        JsonNode ep = epId == null || "draft".equals(epId) ? null : findOrNull(c, "episodes", epId);
        ArrayNode visual = null;
        boolean imageAttached = false;
        switch (kind) {
            case "script", "selection" -> {
                if (!hasScript) focus.put("stage", "idea").put("idea", c.path("idea").asText());
                else if ("draft".equals(epId)) { focus.put("target", "draft").put("content", c.path("draft").asText()); targets.add("draft"); }
                else { focus.put("target", epId).put("episodeNo", ep.path("no").asInt()).put("title", ep.path("title").asText()).put("content", ep.path("content").asText()); targets.add(epId); }
                if ("selection".equals(kind)) { focus.put("selected", scope.path("text").asText()); meta.put("selection", scope.path("text").asText()); }
            }
            case "storyboard" -> {
                focus.put("episodeNo", ep.path("no").asInt()).put("episodeContent", ep.path("content").asText());
                ArrayNode list = focus.putArray("clips");
                for (JsonNode clip : c.path("clips")) if (epId.equals(clip.path("episodeId").asText())) {
                    list.add(clipMaterial(c, clip)); clipIds.add(clip.path("id").asText()); before.with("clips").set(clip.path("id").asText(), clipBefore(clip));
                }
            }
            case "clip", "prompt" -> {
                JsonNode clip = find(c, "clips", scope.path("clipId").asText(), "这个片段");
                JsonNode clipEp = findOrNull(c, "episodes", clip.path("episodeId").asText());
                if (clipEp != null) focus.put("episodeNo", clipEp.path("no").asInt()).put("episodeContent", clipEp.path("content").asText());
                focus.set("clip", clipMaterial(c, clip));
                ArrayNode linked = focus.putArray("linkedAssets");
                for (JsonNode a : visualAssets(c, clip)) linked.addObject().put("id", a.path("id").asText()).put("name", a.path("name").asText()).put("description", a.path("description").asText());
                clipIds.add(clip.path("id").asText());
                before.with("clips").set(clip.path("id").asText(), clipBefore(clip));
                if ("prompt".equals(kind)) { focus.put("which", scope.path("which").asText()); which.add(scope.path("which").asText()); }
            }
            case "asset" -> {
                JsonNode a = find(c, "assets", scope.path("assetId").asText(), "这个资产");
                focus.set("asset", assetMaterial(c, a));
                assetIds.add(a.path("id").asText());
                before.with("assets").set(a.path("id").asText(), assetBefore(a));
            }
            case "image" -> {
                boolean board = "board".equals(scope.path("which").asText(null));
                JsonNode target = board ? find(c, "clips", scope.path("clipId").asText(), "这个片段") : find(c, "assets", scope.path("assetId").asText(), "这个资产");
                JsonNode slot = target.path(board ? "board" : "image");
                String imageKey = adoptedKey(slot);
                if (board) {
                    focus.put("target", "board").set("clip", clipMaterial(c, target));
                    clipIds.add(target.path("id").asText()); which.add("board");
                    before.with("clips").set(target.path("id").asText(), clipBefore(target));
                } else {
                    focus.put("target", "asset").set("asset", assetMaterial(c, target));
                    assetIds.add(target.path("id").asText());
                    before.with("assets").set(target.path("id").asText(), assetBefore(target));
                }
                // 当前采用那张是用什么提示词生成的（之后提示词可能又改过）。
                for (JsonNode m : slot.path("candidates")) if (m.path("id").asText().equals(slot.path("adoptedId").asText()))
                    focus.put("imagePrompt", m.path("prompt").asText(""));
                if (imageKey != null && !fixtures.enabled() && visionModel(c)) {
                    visual = om.createArrayNode();
                    visual.addObject().put("nodeId", target.path("id").asText()).put("title", scope.path("label").asText()).put("type", "image").put("storageKey", imageKey);
                    imageAttached = true;
                }
            }
            default -> { }
        }
        if (Set.of("storyboard", "clip", "prompt", "image").contains(kind)) {
            Limits lim = limits(c);
            if (lim != null) material.putObject("videoLimits").put("minSec", lim.min()).put("maxSec", lim.max()).put("maxShots", lim.maxShots())
                    .put("mode", lim.mode());
        }
        material.put("imageAttached", imageAttached);
        material.set("allowedProposals", om.valueToTree(allowed));
        ArrayNode history = material.putArray("history");
        ArrayNode msgs = (ArrayNode) thread.path("messages");
        for (int i = Math.max(0, msgs.size() - DirectorAssistant.HISTORY); i < msgs.size(); i++) {
            JsonNode m = msgs.get(i);
            if (!"done".equals(m.path("status").asText())) continue;
            ObjectNode h = history.addObject().put("role", m.path("role").asText()).put("about", m.path("scope").path("label").asText())
                    .put("text", DirectorPrompts.clip(m.path("text").asText(), 1500));
            ArrayNode ps = h.putArray("proposals");
            // status 写成中文：真实模型会把「open」的建议当成已经改过（2026-10-28 实测）。
            for (JsonNode p : m.path("proposals")) ps.addObject().put("type", p.path("type").asText()).put("note", p.path("note").asText())
                    .put("status", switch (p.path("status").asText()) { case "applied" -> "用户已采用"; case "dismissed" -> "用户没采用"; default -> "还没采用，内容没有改" ; })
                    .put("text", DirectorPrompts.clip(firstNonBlank(p, "replacement", "text", "prompt", "description"), 600));
        }
        String messageId = "m" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        meta.put("message", DirectorPrompts.clip(text, 400)).put("scopeKind", kind);
        // 测试响应用：一段确实在正文里的原文，固定回复的「局部修改」才能被真正采用。
        if (fixtures.enabled() && targets.size() > 0)
            meta.put("fixtureSample", "selection".equals(kind) ? scope.path("text").asText() : sampleLine(scriptContent(c, targets.get(0).asText())));
        meta.put("messageId", messageId).put("visual", "image".equals(kind) ? (imageAttached ? "seen" : "prompt-only") : "");
        String user = "本次输入（JSON，作为素材）：" + write(material) + "\n\n用户这次说（这是用户的要求）：" + text;
        final ArrayNode fVisual = visual;
        var run = newTx.execute(tx -> textRuns.submitDirectorText(userId, w.getId(), "assistant", DirectorAssistant.SYSTEM, user, 8192, "u-" + clientId, meta,
                c.path("settings").path("textModel").asText(null), req.billing(), req.maxCost(), fVisual));
        track(c, null, run.id(), om.createObjectNode().put("node", "assistant"));
        // 用户消息和一条「正在回复」的助手消息，回复回来后由 applyAssistantReply 填上。
        String now = Instant.now().toString();
        ObjectNode um = msgs.addObject().put("id", "m" + UUID.randomUUID().toString().replace("-", "").substring(0, 12)).put("clientId", clientId)
                .put("role", "user").put("text", text).put("at", now).put("status", "done");
        um.set("scope", scope);
        ObjectNode am = msgs.addObject().put("id", messageId).putNull("clientId").put("role", "assistant").put("text", "").put("at", now)
                .put("status", "pending").put("runId", run.id());
        am.set("scope", scope.deepCopy());
        am.putArray("proposals");
        if (thread.path("title").asText().isBlank()) thread.put("title", DirectorPrompts.clip(text.replaceAll("\\s+", " "), 24));
        thread.put("updatedAt", now);
        w.setActive(true);
    }

    private static String firstNonBlank(JsonNode n, String... fields) {
        for (String f : fields) if (!n.path(f).asText("").isBlank()) return n.path(f).asText();
        return "";
    }

    /** 作品当前的文字模型能不能看图：只认后台声明的能力（StudioVisualContext.supportsVision）。 */
    private boolean visionModel(ObjectNode c) {
        String model = c.path("settings").path("textModel").asText(null);
        return textRuns.capabilities().textModels().stream()
                .filter(m -> model == null ? m.isDefault() : model.equals(m.endpointId()))
                .findFirst().map(m -> m.supportsVision()).orElse(false);
    }

    /** 校验客户端给的范围，并由服务端写对象说明（不信客户端的 label）。 */
    private ObjectNode resolveScope(ObjectNode c, DirectorWork w, JsonNode in) {
        String kind = in.path("kind").asText("work");
        if (!DirectorAssistant.SCOPES.contains(kind)) throw invalid("不支持的讨论范围");
        ObjectNode s = om.createObjectNode().put("kind", kind);
        boolean hasEpisodes = c.path("episodes").size() > 0;
        switch (kind) {
            case "work" -> s.put("label", "整部作品");
            case "script", "selection" -> {
                String epId = in.path("episodeId").asText(null);
                if (hasEpisodes) {
                    JsonNode ep = find(c, "episodes", epId, "这一集");
                    s.put("episodeId", epId).put("label", "第 " + ep.path("no").asInt() + " 集 · " + ep.path("title").asText());
                } else if (!c.path("draft").asText().isBlank()) s.put("episodeId", "draft").put("label", "剧本（未拆集）");
                else if ("selection".equals(kind)) throw invalid("还没有剧本正文");
                else s.putNull("episodeId").put("label", "创意与剧本");
                if ("selection".equals(kind)) {
                    String text = in.path("text").asText("");
                    if (text.isBlank()) throw invalid("请先选中一段正文");
                    if (text.length() > DirectorAssistant.MAX_SELECTION) throw invalid("选中的正文太长，请少选一些（最多 " + DirectorAssistant.MAX_SELECTION + " 字）");
                    // 选区是具体位置，不只是文字：同样的话出现两处时，改的必须是用户选中的那一处。
                    // 前端发送前先保存正文，这里按保存后的正文核对位置。
                    String content = scriptContent(c, s.path("episodeId").asText());
                    int start = in.path("start").asInt(-1), end = in.path("end").asInt(-1);
                    if (start < 0 || end <= start || end > content.length() || !content.substring(start, end).equals(text))
                        throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_SELECTION_CHANGED", "选中的正文和当前正文对不上，请重新选择要修改的段落");
                    s.put("text", text).put("start", start).put("end", end).put("label", s.path("label").asText() + " · 已选正文");
                }
            }
            case "storyboard" -> {
                JsonNode ep = find(c, "episodes", in.path("episodeId").asText(null), "这一集");
                s.put("episodeId", ep.path("id").asText()).put("label", "第 " + ep.path("no").asInt() + " 集 · 全部片段");
            }
            case "clip", "prompt" -> {
                JsonNode clip = find(c, "clips", in.path("clipId").asText(null), "这个片段");
                s.put("clipId", clip.path("id").asText()).put("episodeId", clip.path("episodeId").asText());
                String base = clipLabel(c, clip);
                if ("prompt".equals(kind)) {
                    String which = in.path("which").asText("");
                    if (!Set.of("board", "video").contains(which)) throw invalid("请选择分镜图提示词或视频提示词");
                    s.put("which", which).put("label", base + " · " + ("board".equals(which) ? "分镜图提示词" : "视频提示词"));
                } else s.put("label", base + " · 镜头");
            }
            case "asset" -> {
                JsonNode a = find(c, "assets", in.path("assetId").asText(null), "这个资产");
                s.put("assetId", a.path("id").asText()).put("label", DirectorPrompts.kindLabel(a.path("kind").asText()) + " · " + a.path("name").asText());
            }
            case "image" -> {
                if ("board".equals(in.path("which").asText(null))) {
                    JsonNode clip = find(c, "clips", in.path("clipId").asText(null), "这个片段");
                    if (adoptedKey(clip.path("board")) == null) throw invalid("这个片段还没有采用的分镜图");
                    s.put("clipId", clip.path("id").asText()).put("episodeId", clip.path("episodeId").asText()).put("which", "board")
                            .put("label", clipLabel(c, clip) + " · 分镜图");
                } else {
                    JsonNode a = find(c, "assets", in.path("assetId").asText(null), "这个资产");
                    if (adoptedKey(a.path("image")) == null) throw invalid("这个资产还没有采用的参考图");
                    s.put("assetId", a.path("id").asText()).put("label", a.path("name").asText() + " · 参考图");
                }
            }
            default -> { }
        }
        return s;
    }

    private String clipLabel(ObjectNode c, JsonNode clip) {
        JsonNode ep = findOrNull(c, "episodes", clip.path("episodeId").asText());
        return (ep == null ? "" : "第 " + ep.path("no").asInt() + " 集 · ") + "片段 " + clip.path("order").asInt();
    }

    private ObjectNode clipMaterial(ObjectNode c, JsonNode clip) {
        ObjectNode m = om.createObjectNode().put("id", clip.path("id").asText()).put("order", clip.path("order").asInt())
                .put("title", clip.path("title").asText()).put("summary", clip.path("summary").asText()).put("durationSec", clip.path("durationSec").asDouble());
        m.set("assetIds", clip.path("assetIds"));
        ArrayNode shots = m.putArray("shots");
        for (JsonNode s : clip.path("shots")) {
            ObjectNode shot = shots.addObject().put("id", s.path("id").asText()).put("durationSec", s.path("durationSec").asDouble())
                    .put("size", s.path("size").asText()).put("camera", s.path("camera").asText()).put("action", s.path("action").asText()).put("still", s.path("still").asText());
            ArrayNode d = shot.putArray("dialogue");
            for (JsonNode l : s.path("dialogue")) {
                JsonNode sp = findOrNull(c, "assets", l.path("speakerId").asText(null));
                ObjectNode line = d.addObject();
                if (l.path("speakerId").isTextual()) line.put("speakerId", l.path("speakerId").asText()); else line.putNull("speakerId");
                line.put("speaker", sp == null ? "旁白" : sp.path("name").asText()).put("text", l.path("text").asText());
            }
        }
        m.put("boardPrompt", clip.path("boardPrompt").asText()).put("videoPrompt", clip.path("videoPrompt").asText());
        return m;
    }

    private ObjectNode clipBefore(JsonNode clip) {
        ObjectNode b = om.createObjectNode().put("shotsSig", shotsSig(clip.path("shots")))
                .put("board", clip.path("boardPrompt").asText()).put("boardCustom", clip.path("boardPromptCustom").asBoolean(false))
                .put("video", clip.path("videoPrompt").asText()).put("videoCustom", clip.path("videoPromptCustom").asBoolean(false));
        b.set("shots", clip.path("shots").deepCopy());
        return b;
    }

    private ObjectNode assetMaterial(ObjectNode c, JsonNode a) {
        ObjectNode m = om.createObjectNode().put("id", a.path("id").asText()).put("kind", a.path("kind").asText()).put("name", a.path("name").asText())
                .put("description", a.path("description").asText()).put("prompt", a.path("prompt").asText()).put("voiceDesc", a.path("voiceDesc").asText(""));
        m.set("aliases", a.path("aliases"));
        ArrayNode nos = m.putArray("episodeNos");
        for (JsonNode ep : c.path("episodes")) if (contains(a.path("episodeIds"), ep.path("id").asText())) nos.add(ep.path("no").asInt());
        return m;
    }

    private ObjectNode assetBefore(JsonNode a) {
        return om.createObjectNode().put("description", a.path("description").asText()).put("prompt", a.path("prompt").asText())
                .put("promptCustom", a.path("promptCustom").asBoolean(false)).put("voiceDesc", a.path("voiceDesc").asText(""));
    }

    /** 镜头内容的签名（不含起止秒）：判断片段在助手回复之后有没有被改过。 */
    private String shotsSig(JsonNode shots) {
        ArrayNode out = om.createArrayNode();
        for (JsonNode s : shots) {
            ObjectNode x = out.addObject().put("d", s.path("durationSec").asDouble()).put("z", s.path("size").asText()).put("c", s.path("camera").asText())
                    .put("a", s.path("action").asText()).put("s", s.path("still").asText());
            ArrayNode d = x.putArray("l");
            for (JsonNode l : s.path("dialogue")) d.add(l.path("speakerId").asText("") + ":" + l.path("text").asText());
        }
        return hash(write(out));
    }

    /** 回复回来：填进那条「正在回复」的消息。建议的旧值来自发送时的快照（助手看到的是什么）。 */
    private void applyAssistantReply(ObjectNode c, IpRun run) {
        JsonNode meta = parse(run.getInputJson()).path("_director");
        ObjectNode[] found = findMessage(c, "id", meta.path("messageId").asText(null));
        if (found == null) return;
        ObjectNode thread = found[0], msg = found[1];
        thread.put("updatedAt", Instant.now().toString());
        if (IpRun.STATUS_FAILED.equals(run.getStatus())) {
            msg.put("status", "failed").put("error", run.getErrorMessage() == null ? "助手没有回复成功，请重新发送" : run.getErrorMessage());
            return;
        }
        JsonNode d = parse(run.getOutputJson()).path("director");
        msg.put("status", "done").put("text", d.path("reply").asText()).put("dropped", d.path("dropped").asInt(0));
        if (!meta.path("visual").asText().isBlank()) msg.put("visual", meta.path("visual").asText());
        ArrayNode proposals = msg.putArray("proposals");
        int n = 0;
        for (JsonNode p : d.path("proposals")) {
            ObjectNode r = ((ObjectNode) p.deepCopy()).put("id", "p" + (++n)).put("status", "open");
            r.putNull("appliedAt");
            switch (r.path("type").asText()) {
                case "script.replace" -> {
                    r.put("targetLabel", scriptLabel(c, r.path("target").asText()));
                    ObjectNode anchor = replyAnchor(c, msg.path("scope"), r.path("target").asText(), r.path("original").asText());
                    if (anchor == null) { msg.put("dropped", msg.path("dropped").asInt() + 1); continue; }
                    r.set("anchor", anchor);
                }
                case "script.append" -> r.put("targetLabel", scriptLabel(c, r.path("target").asText()));
                case "script.draft", "idea.update" -> r.put("targetLabel", "script.draft".equals(r.path("type").asText()) ? "剧本" : "创意");
                case "clip.shots", "clip.prompt" -> {
                    JsonNode clip = findOrNull(c, "clips", r.path("clipId").asText());
                    if (clip == null) continue;
                    r.put("targetLabel", clipLabel(c, clip));
                    JsonNode b = meta.path("before").path("clips").path(r.path("clipId").asText());
                    if ("clip.shots".equals(r.path("type").asText())) {
                        r.set("beforeShots", b.path("shots").deepCopy());
                        r.put("beforeSig", b.path("shotsSig").asText());
                        // 原镜头 id 只认这个片段自己的，其它当新镜头。
                        Set<String> own = DirectorAssistant.ids(b.path("shots"), "id");
                        for (JsonNode s : r.path("shots")) if (s.hasNonNull("id") && !own.contains(s.path("id").asText())) ((ObjectNode) s).putNull("id");
                    } else {
                        String w = r.path("which").asText();
                        r.putObject("before").put("text", b.path(w).asText()).put("custom", b.path(w + "Custom").asBoolean(false));
                    }
                }
                case "asset.update" -> {
                    JsonNode a = findOrNull(c, "assets", r.path("assetId").asText());
                    if (a == null) continue;
                    r.put("targetLabel", DirectorPrompts.kindLabel(a.path("kind").asText()) + " · " + a.path("name").asText());
                    r.set("before", meta.path("before").path("assets").path(r.path("assetId").asText()).deepCopy());
                    // 同时改了外观设定、出图提示词又是自动生成的：提示词会按新设定重编，不再带模型抄改的那份，
                    // 免得采用后提示词被固定成「已自定义」、之后再改设定不跟着变（真实模型常两个都填）。
                    if (r.hasNonNull("description") && r.hasNonNull("prompt") && !r.path("regenerate").asBoolean(false)
                            && !r.path("before").path("promptCustom").asBoolean(false)) r.remove("prompt");
                }
                default -> { continue; }
            }
            proposals.add(r);
        }
    }

    /**
     * 回复回来时把剧本建议钉到正文的具体一处：选中了段落就只在选区里找；没选就要求原文在这一集里只出现一处，
     * 出现多处、找不到都丢掉（计入「已略过」），不让「多处取第一处」改错地方。
     */
    private ObjectNode replyAnchor(ObjectNode c, JsonNode scope, String target, String original) {
        String content;
        try { content = scriptContent(c, target); } catch (BusinessException e) { return null; }
        if ("selection".equals(scope.path("kind").asText()) && target.equals(scope.path("episodeId").asText())) {
            String sel = scope.path("text").asText();
            int[] rel = DirectorAssistant.locate(sel, original);
            if (rel == null || DirectorAssistant.locateAll(sel, original).size() > 1) return null;
            int start = scope.path("start").asInt(-1);
            if (start < 0 || start + sel.length() > content.length() || !content.startsWith(sel, start)) {
                // 回复期间正文改过：选中的那段文字还唯一存在就跟着它走，否则放弃
                List<int[]> moved = DirectorAssistant.locateAll(content, sel);
                if (moved.size() != 1 || !content.substring(moved.get(0)[0], moved.get(0)[1]).equals(sel)) return null;
                start = moved.get(0)[0];
            }
            return DirectorAssistant.anchorAt(om, content, start + rel[0], start + rel[1]);
        }
        List<int[]> hits = DirectorAssistant.locateAll(content, original);
        return hits.size() == 1 ? DirectorAssistant.anchorAt(om, content, hits.get(0)[0], hits.get(0)[1]) : null;
    }

    private String scriptLabel(ObjectNode c, String target) {
        if ("draft".equals(target)) return "剧本（未拆集）";
        JsonNode ep = findOrNull(c, "episodes", target);
        return ep == null ? "已删除的一集" : "第 " + ep.path("no").asInt() + " 集";
    }

    private static BusinessException stale(String message) {
        return new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_PROPOSAL_STALE", message);
    }

    /** 采用 / 放弃 / 撤销一条建议。 */
    private void proposalOp(String userId, DirectorWork w, ObjectNode c, String op, JsonNode d) {
        ObjectNode[] found = findMessage(c, "id", d.path("messageId").asText(null));
        ObjectNode p = null;
        if (found != null) for (JsonNode x : found[1].path("proposals")) if (x.path("id").asText().equals(d.path("proposalId").asText())) p = (ObjectNode) x;
        if (p == null) throw BusinessException.notFound("DIRECTOR_PROPOSAL_NOT_FOUND", "这条建议不存在，请刷新");
        String undoKey = found[1].path("id").asText() + ":" + p.path("id").asText();
        ObjectNode undoStore = c.with("assistantUndo");
        String status = p.path("status").asText();
        switch (op) {
            case "assistant.dismiss" -> {
                if (!"open".equals(status)) throw stale("这条建议已经处理过了");
                p.put("status", "dismissed");
            }
            case "assistant.apply" -> {
                if (!"open".equals(status)) throw stale("这条建议已经处理过了");
                undoStore.set(undoKey, applyProposal(w, c, p));
                p.put("status", "applied").put("appliedAt", Instant.now().toString());
            }
            case "assistant.undo" -> {
                JsonNode undo = undoStore.path(undoKey);
                if (!"applied".equals(status) || !undo.isObject()) throw stale("这条建议不能撤销");
                undoProposal(w, c, p, undo);
                undoStore.remove(undoKey);
                p.put("status", "open").putNull("appliedAt");
            }
            default -> throw invalid("不支持的修改");
        }
    }

    /** 写入一条建议，返回撤销所需的数据。写入前核对：助手看到的内容之后被改过，就不覆盖。 */
    private ObjectNode applyProposal(DirectorWork w, ObjectNode c, ObjectNode p) {
        ObjectNode undo = om.createObjectNode();
        switch (p.path("type").asText()) {
            case "script.replace" -> {
                String target = p.path("target").asText();
                String content = scriptContent(c, target);
                JsonNode a = p.path("anchor");
                int[] r = a.isObject() ? DirectorAssistant.findAnchor(content, a.path("text").asText(), a.path("before").asText(), a.path("after").asText(), a.path("start").asInt())
                        : uniqueOrNull(content, p.path("original").asText());
                if (r == null) throw stale("原文已经改动，找不到这条建议要替换的那一处。可以让助手按现在的正文重新给建议");
                String replacement = p.path("replacement").asText();
                String after = DirectorAssistant.splice(content, r, replacement);
                // 撤销按「这一处」找回：记下替换后的位置和前后文，删除（替换为空）也能撤销。
                undo.put("original", content.substring(r[0], r[1])).put("replacement", replacement).put("at", r[0])
                        .put("before", content.substring(Math.max(0, r[0] - DirectorAssistant.CONTEXT), r[0]))
                        .put("after", content.substring(r[1], Math.min(content.length(), r[1] + DirectorAssistant.CONTEXT)));
                writeScript(c, target, after);
            }
            case "script.append" -> {
                String target = p.path("target").asText();
                String content = scriptContent(c, target);
                String added = (content.isBlank() || content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n") + p.path("text").asText();
                undo.put("added", added);
                writeScript(c, target, content + added);
            }
            case "script.draft" -> {
                if (!c.path("draft").asText().isBlank() || c.path("episodes").size() > 0) throw stale("已经有剧本了，这份草稿不能直接采用。可以让助手在现有剧本上修改");
                undo.put("title", w.getTitle()).put("logline", c.path("logline").asText());
                c.put("draft", limited(p.path("content").asText(), 60000, "剧本")).put("draftRev", c.path("draftRev").asLong() + 1);
                if (!p.path("title").asText().isBlank()) w.setTitle(limited(p.path("title").asText(), 60, "作品名"));
                if (!p.path("logline").asText().isBlank()) c.put("logline", p.path("logline").asText());
                undo.put("draftRev", c.path("draftRev").asLong());
            }
            case "idea.update" -> {
                undo.put("idea", c.path("idea").asText()).put("applied", p.path("text").asText());
                c.put("idea", limited(p.path("text").asText(), 2000, "创意"));
            }
            case "clip.shots" -> {
                ObjectNode clip = find(c, "clips", p.path("clipId").asText(), "这个片段");
                if (!shotsSig(clip.path("shots")).equals(p.path("beforeSig").asText()))
                    throw stale("这个片段的镜头在助手回复后又改过，这条建议没有写入。可以让助手按现在的镜头重新给建议");
                if (clip.path("video").path("pending").size() > 0) throw new BusinessException(HttpStatus.CONFLICT, "DIRECTOR_TASK_RUNNING", "这个片段的视频正在生成，完成后再改镜头");
                undo.set("shots", clip.path("shots").deepCopy());
                setShots(c, clip, p.path("shots"), true);
                bump(clip);
                undo.put("rev", clip.path("rev").asLong());
            }
            case "clip.prompt" -> {
                ObjectNode clip = find(c, "clips", p.path("clipId").asText(), "这个片段");
                String which = p.path("which").asText(), field = which + "Prompt";
                boolean custom = clip.path(field + "Custom").asBoolean(false);
                // 自动生成的提示词会随镜头变，不算用户改过；用户自己改过、又和助手看到的不一样，才不覆盖。
                if (custom && !clip.path(field).asText().equals(p.path("before").path("text").asText()))
                    throw stale(("board".equals(which) ? "分镜图" : "视频") + "提示词在助手回复后又改过，这条建议没有写入");
                undo.put("text", clip.path(field).asText()).put("custom", custom).put("applied", p.path("text").asText());
                clip.put(field, limited(p.path("text").asText(), 7000, "提示词")).put(field + "Custom", true);
                bump(clip);
            }
            case "asset.update" -> {
                ObjectNode a = find(c, "assets", p.path("assetId").asText(), "这个资产");
                JsonNode b = p.path("before");
                if (p.hasNonNull("description") && !a.path("description").asText().equals(b.path("description").asText()))
                    throw stale("「" + a.path("name").asText() + "」的外观设定在助手回复后又改过，这条建议没有写入");
                if (p.hasNonNull("prompt") && a.path("promptCustom").asBoolean(false) && !a.path("prompt").asText().equals(b.path("prompt").asText()))
                    throw stale("「" + a.path("name").asText() + "」的出图提示词在助手回复后又改过，这条建议没有写入");
                if (p.hasNonNull("voiceDesc") && !a.path("voiceDesc").asText("").equals(b.path("voiceDesc").asText("")))
                    throw stale("「" + a.path("name").asText() + "」的音色描述在助手回复后又改过，这条建议没有写入");
                undo.put("description", a.path("description").asText()).put("prompt", a.path("prompt").asText())
                        .put("promptCustom", a.path("promptCustom").asBoolean(false)).put("voiceDesc", a.path("voiceDesc").asText(""));
                if (p.hasNonNull("description")) a.put("description", limited(p.path("description").asText(), 2000, "描述"));
                if (p.hasNonNull("voiceDesc")) a.put("voiceDesc", limited(p.path("voiceDesc").asText(), 200, "音色描述"));
                if (p.hasNonNull("prompt")) a.put("prompt", limited(p.path("prompt").asText(), 4000, "提示词")).put("promptCustom", true);
                bump(a);
                undo.put("rev", a.path("rev").asLong());
            }
            default -> throw invalid("不支持的建议");
        }
        return undo;
    }

    private void undoProposal(DirectorWork w, ObjectNode c, ObjectNode p, JsonNode u) {
        String cannot = "采用之后又改过，不能自动撤销。请直接修改";
        switch (p.path("type").asText()) {
            case "script.replace" -> {
                String target = p.path("target").asText();
                String content = scriptContent(c, target);
                int[] r = DirectorAssistant.findAnchor(content, u.path("replacement").asText(), u.path("before").asText(), u.path("after").asText(), u.path("at").asInt());
                if (r == null) throw stale(cannot);
                writeScript(c, target, DirectorAssistant.splice(content, r, u.path("original").asText()));
            }
            case "script.append" -> {
                String target = p.path("target").asText();
                String content = scriptContent(c, target), added = u.path("added").asText();
                if (!content.endsWith(added)) throw stale(cannot);
                writeScript(c, target, content.substring(0, content.length() - added.length()));
            }
            case "script.draft" -> {
                if (c.path("episodes").size() > 0 || c.path("draftRev").asLong() != u.path("draftRev").asLong()) throw stale(cannot);
                c.put("draft", "").put("draftRev", c.path("draftRev").asLong() + 1).put("logline", u.path("logline").asText());
                w.setTitle(u.path("title").asText(w.getTitle()));
            }
            case "idea.update" -> {
                if (!c.path("idea").asText().equals(u.path("applied").asText())) throw stale(cannot);
                c.put("idea", u.path("idea").asText());
            }
            case "clip.shots" -> {
                ObjectNode clip = find(c, "clips", p.path("clipId").asText(), "这个片段");
                if (clip.path("rev").asLong() != u.path("rev").asLong()) throw stale(cannot);
                setShots(c, clip, u.path("shots"), true);
                bump(clip);
            }
            case "clip.prompt" -> {
                ObjectNode clip = find(c, "clips", p.path("clipId").asText(), "这个片段");
                String field = p.path("which").asText() + "Prompt";
                if (!clip.path(field).asText().equals(u.path("applied").asText())) throw stale(cannot);
                clip.put(field, u.path("text").asText()).put(field + "Custom", u.path("custom").asBoolean(false));
                bump(clip);
            }
            case "asset.update" -> {
                ObjectNode a = find(c, "assets", p.path("assetId").asText(), "这个资产");
                if (a.path("rev").asLong() != u.path("rev").asLong()) throw stale(cannot);
                a.put("description", u.path("description").asText()).put("prompt", u.path("prompt").asText())
                        .put("promptCustom", u.path("promptCustom").asBoolean(false)).put("voiceDesc", u.path("voiceDesc").asText(""));
                bump(a);
            }
            default -> throw invalid("不支持的建议");
        }
    }

    /** 没有锚点的旧建议：原文唯一出现才改。 */
    private static int[] uniqueOrNull(String content, String original) {
        List<int[]> hits = DirectorAssistant.locateAll(content, original);
        return hits.size() == 1 ? hits.get(0) : null;
    }

    private String scriptContent(ObjectNode c, String target) {
        if ("draft".equals(target)) {
            if (c.path("episodes").size() > 0) throw stale("剧本已经拆分成集，这条建议对应的是拆集前的整份剧本");
            return c.path("draft").asText();
        }
        return find(c, "episodes", target, "这一集").path("content").asText();
    }

    /** 和用户自己改正文同一套效果：集修订号 +1，已有片段的集标「正文改过」，不自动重写分镜。 */
    private void writeScript(ObjectNode c, String target, String content) {
        String text = limited(content, 60000, "正文");
        if ("draft".equals(target)) { c.put("draft", text).put("draftRev", c.path("draftRev").asLong() + 1); return; }
        ObjectNode ep = find(c, "episodes", target, "这一集");
        ep.put("content", text);
        if (hasClips(c, target)) ep.put("planStale", true);
        bump(ep);
    }

    /** 出 wire 时标出哪些已采用的建议还能撤销（撤销数据本身不出 wire）。 */
    private void markUndoable(ObjectNode c, ObjectNode v) {
        JsonNode undo = c.path("assistantUndo");
        for (JsonNode t : v.path("assistant").path("threads"))
            for (JsonNode m : t.path("messages")) for (JsonNode p : m.path("proposals"))
                ((ObjectNode) p).put("undoable", "applied".equals(p.path("status").asText()) && undo.path(m.path("id").asText() + ":" + p.path("id").asText()).isObject());
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
        long[] prices = textRuns.directorPrices(c.path("settings").path("textModel").asText(null));
        Limits lim = limits(c);
        List<JsonNode> eps = new ArrayList<>();
        for (JsonNode ep : c.path("episodes")) if (work || req.episodeId() == null || req.episodeId().equals(ep.path("id").asText())) eps.add(ep);
        if (!work && req.episodeId() == null && eps.size() > 1) eps = List.of(eps.get(0));
        int text = 0, images = 0, clipsTotal = 0, seconds = 0, plannedVideos = 0;
        long videoCredits = 0;
        boolean rough = false;
        String videoError = null;
        boolean toVideo = Set.of("video", "film").contains(target);
        int perClip = lim == null ? 0 : lim.max();
        int estClipsPerEp = lim == null ? 0 : Math.max(1, (int) Math.ceil(75.0 / Math.max(1, lim.max())));
        if (c.path("episodes").isEmpty()) {
            rough = true;
            if (c.path("draft").asText().isBlank()) text++;   // 写剧本
            int n = work ? 3 : 1;
            text += 2 + n;                                    // 拆分 + 提取 + 每集写分镜脚本
            images += 6;                                      // 角色、场景、道具参考图
            clipsTotal = n * estClipsPerEp;
            images += clipsTotal;                             // 分镜图
        } else {
            if (eps.stream().anyMatch(e -> !e.path("extracted").asBoolean(false))) text++;
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
                if (clips.isEmpty()) { rough = true; text++; clipsTotal += estClipsPerEp; images += estClipsPerEp; continue; }
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
        long textCredits = (long) text * prices[0], imageCredits = (long) images * prices[1];
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
        Step step = new Step(userId, w, c, p, spent, inflight, busy, textRuns.directorPrices(c.path("settings").path("textModel").asText(null)), billing);
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
                    if (clip.path("video").path("candidates").size() > 0 || failed.contains("video:" + cid) || adoptedKey(clip.path("board")) == null) continue;
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
                    : "export".equals(type) ? 0 : Set.of("asset-image", "board").contains(type) ? prices[1] : prices[0];
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

    // ── 出 wire ───────────────────────────────────────────────────────────────

    private JsonNode view(String userId, DirectorWork w, ObjectNode c) {
        ObjectNode v = c.deepCopy();
        v.remove("applied"); v.remove("taskMeta"); v.remove("seq"); v.remove("assistantUndo");
        markUndoable(c, v);
        v.put("id", w.getId()).put("title", w.getTitle()).put("revision", w.getRevision())
                .put("createdAt", w.getCreatedAt().toString()).put("updatedAt", w.getUpdatedAt().toString());
        ArrayNode tasks = v.putArray("tasks");
        // 在新事务里读：本次请求刚在独立事务里建的任务，MySQL 可重复读下外层事务的快照看不到，
        // 页面会以为没在生成、也不轮询（2026-10-24 线上：点「生成剧本」没反应，再点报「该项生成中」）。
        List<IpRun> mine = newTx.execute(tx -> runs.findByProjectIdOrderByCreatedAtDesc(w.getId()));
        for (IpRun r : mine.subList(0, Math.min(40, mine.size()))) {
            tasks.addObject().put("id", r.getId()).put("target", r.getNodeId()).put("status", r.getStatus())
                    .put("stage", r.getStage()).put("cost", r.getCost()).put("errorMessage", r.getErrorMessage())
                    .put("createdAt", r.getCreatedAt() == null ? null : r.getCreatedAt().toString());
        }
        for (JsonNode clip : c.path("clips")) for (JsonNode pend : clip.path("video").path("pending"))
            tasks.insertObject(0).put("id", pend.path("jobId").asText()).put("target", "video:" + clip.path("id").asText()).put("status", "running")
                    .put("stage", pend.path("stage").asText()).put("cost", 0).putNull("errorMessage").put("createdAt", pend.path("at").asText());
        long[] prices = textRuns.directorPrices(c.path("settings").path("textModel").asText(null));
        v.putObject("pricing").put("textMax", prices[0]).put("image", prices[1]).put("mock", fixtures.enabled());
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
        Map<String, Integer> lastOrder = new HashMap<>();
        for (JsonNode clip : c.path("clips")) lastOrder.merge(clip.path("episodeId").asText(), clip.path("order").asInt(), Math::max);
        for (JsonNode clipNode : c.path("clips")) {
            ObjectNode clip = (ObjectNode) clipNode;
            List<DirectorPrompts.Ref> refs = new ArrayList<>();
            for (JsonNode a : visualAssets(c, clip))
                refs.add(new DirectorPrompts.Ref("图" + (refs.size() + 1), a.path("kind").asText(), a.path("name").asText()));
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
        var endpoint = scenePolicies.resolve("studio", "image", null, 0).resolved().endpoint();
        var spec = com.aistareco.aep.model.AiImageRequestSpec.read(endpoint.getImageRequestSpecJson());
        if (spec == null) return fallback;
        // 同一比例有几档时取最大的：设定集、宫格分镜图要放好几个分区，小图细节糊；按张计费，价格不变。
        // 线上 GPT Image 2 的 1360x768 偶尔被厂商按 4:3 出图、被尺寸校验拦下，2048x1152 一周内没有出过错（2026-10-25 日志）。
        return spec.outputs().stream().filter(o -> ratio.equals(o.aspectRatio()))
                .map(com.aistareco.aep.model.AiImageRequestSpec.Output::canvasSize)
                .max(Comparator.comparingLong(DirectorService::pixels))
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "STUDIO_IMAGE_SIZE_UNSUPPORTED",
                        "当前图片模型不支持 " + ratio + " 画幅，请在作品设置里换一个画幅，或联系管理员更换图片模型"));
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

    /**
     * 资产库对象写进作品。场景、道具的图直接成为采用的参考图；角色的图（没有图时用资产库的形象参考）只当「形象参考」，
     * 设定图仍由系统按设定集版式生成，与上传照片同一条规则。按导入（换图）时总是用新图；按名字对上已有资产时
     * 不动它已采用的图和已有的形象参考，只补空着的。
     */
    void importFromLibrary(String userId, ObjectNode c, ObjectNode explicit, IpLibraryDtos.LibraryObject o, String versionId, String episodeId) {
        IpLibraryDtos.LibraryVersion version = null;
        if (versionId != null && !versionId.isBlank()) {
            for (IpLibraryDtos.LibraryVersion v : o.versions()) if (versionId.equals(v.id())) version = v;
            if (version == null) throw BusinessException.notFound("DIRECTOR_LIBRARY_VERSION_NOT_FOUND", "「" + o.name() + "」的这一版图片已不存在，请刷新资产库后重选");
        } else for (IpLibraryDtos.LibraryVersion v : o.versions()) if (v.id().equals(o.mainVersionId())) version = v;
        String key = projects.requireOwnedAssetKey(userId, version == null ? null : version.storageKey());
        if (explicit != null && key == null && !("character".equals(explicit.path("kind").asText()) && o.referenceKey() != null))
            throw invalid("「" + o.name() + "」在资产库里还没有图片，请换一项");
        ObjectNode target = explicit;
        if (target == null) {
            if (!Set.of("character", "scene", "prop").contains(o.kind())) throw invalid("「" + o.name() + "」不是角色、场景或道具");
            String name = o.name() == null ? "" : o.name().trim();
            if (name.isEmpty()) throw invalid("资产库里有一项没有名称，请先补上名称");
            if (name.length() > 40) throw invalid("「" + name + "」的名称超过 40 字，请先在资产库里改短");
            String description = o.description() == null ? "" : o.description().trim();
            if (description.length() > 2000) throw invalid("「" + name + "」的描述超过 2000 字，请先在资产库里改短");
            JsonNode hit = null;
            for (JsonNode x : c.path("assets"))
                if (hit == null && o.id().equals(x.path("libraryObjectId").asText()) && o.kind().equals(x.path("kind").asText())) hit = x;
            if (hit == null) hit = matchAsset(c, null, o.kind(), name);
            if (hit == null) {
                target = newAsset(c, o.kind(), name, description);
                ((ArrayNode) c.path("assets")).add(target);
            } else {
                target = (ObjectNode) hit;
                if (target.path("description").asText().isBlank()) target.put("description", description);
            }
            if (episodeId != null && !ids(target.path("episodeIds")).contains(episodeId)) ((ArrayNode) target.path("episodeIds")).add(episodeId);
            // 只记「这项资产就是资产库里的那一项」；给别的资产借图（explicit）不改它，免得之后正常导入时对错资产。
            target.put("libraryObjectId", o.id());
        }
        if ("character".equals(target.path("kind").asText())) {
            String ref = key != null ? key : projects.requireOwnedAssetKey(userId, o.referenceKey());
            if (ref != null && (explicit != null || target.path("refImage").path("key").asText("").isEmpty())) target.putObject("refImage").put("key", ref);
        } else if (key != null) {
            ObjectNode slot = (ObjectNode) target.path("image");
            ObjectNode m = addCandidate(c, slot, key, null, "library");
            if (explicit != null || slot.path("adoptedId").isNull() || slot.path("adoptedId").isMissingNode()) adopt(target, "image", m.path("id").asText());
        }
        bump(target);
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

    /**
     * 用户最初的创意随分集、规划一起交给模型，让时长 / 集数 / 镜头数等要求一路生效；导入剧本没有创意就不放。
     * 有故事大纲时一并给（人物身份、主线），分集和提取对得上整体故事。
     */
    private static void putBrief(ObjectNode in, JsonNode c) {
        String idea = c.path("idea").asText();
        if (!idea.isBlank()) in.put("brief", idea);
        if (c.path("outline").isObject()) in.set("outline", c.path("outline"));
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

    /** 正文里第一行不是场次标题的原文（测试响应用）。 */
    private static String sampleLine(String s) {
        for (String line : s.split("\\r?\\n")) {
            String t = line.trim();
            if (!t.isEmpty() && !t.startsWith("#")) return t.length() <= 80 ? t : t.substring(0, 80);
        }
        return "";
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
