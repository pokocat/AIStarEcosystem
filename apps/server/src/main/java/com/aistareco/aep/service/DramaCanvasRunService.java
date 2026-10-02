package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaConfigSeeder;
import com.aistareco.aep.dto.DramaCanvasRunDto;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasAssembleRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasExtractRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageBatchBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageBatchItem;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasScriptRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasStoryboardRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasVideoRunBody;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaCanvas;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * 画布的生成（v0.198，设计真源 docs/drama-canvas-plan.md §3.3 / §4 / §4.1）：提交（幂等 → 校验版本 → 从库里的文档
 * 取一切输入 → preflight → 冻结 → 存记录 → afterCommit 派发）、批量查、取消。后台执行在 {@link DramaCanvasRunWorker}。
 *
 * <p><b>顺序是硬约束</b>（§8.0 / ipstudio 教训）：
 * <ol>
 *   <li>同一个 (owner, clientRequestId) 已经有记录 → 原样返回，不再校验、不再冻结；</li>
 *   <li>{@code requireCanvas} → {@code requireVersion}（对不上 409）→ 读<b>库里那份</b>文档（客户端不传提示词 / 参考图 / 首帧）；</li>
 *   <li>preflight 全部在冻结之前：引擎配置、提示词模板、归属闸（别人的 key → 400 且不冻结）、锁住的集、时长上限、
 *       有没有东西可合成、存储配额；</li>
 *   <li>冻结（单价快照写进 input_json，worker 只认这份）→ 存记录 → <b>afterCommit 里派发</b>（事务里直接派发，
 *       worker 查不到行，任务永远 queued —— ipstudio 真联调踩过）。</li>
 * </ol>
 * 并发插入撞唯一键 → 整个事务（含冻结）回滚 → 回查已有记录返回。
 *
 * <p>积分只经 {@link CreditService} 的 hold / commitHold / releaseHold（§4.2 账本不可变）。视频的冻结与结算由
 * {@code MaterialVideoJobService} 那条链负责，这里只记 jobId。
 */
@Service
public class DramaCanvasRunService {

    private static final Logger log = LoggerFactory.getLogger(DramaCanvasRunService.class);

    /** CreditHold referenceType；referenceId = runId（单条）或批量出图的 batch 引用。 */
    public static final String REF_TYPE = "drama-canvas-run";
    static final int MAX_QUERY_IDS = 50;
    /**
     * 批量出图上限：最多 20 项、总共 40 张。worker 串行出图，还要在 {@code DramaCanvasRunWorker.RUN_DEADLINE}（90 分钟）
     * 内跑完 —— 那又是为了远早于 CreditHoldSweeper 按 hold 的 createdAt 算的 180 分钟 TTL（见 worker 类注释）。
     * 40 张按每张 1–2 分钟算是 40–80 分钟，在 90 分钟以内；再多就可能跑到冻结被系统退掉之后。
     */
    static final int MAX_BATCH_ITEMS = 20;
    static final int MAX_BATCH_IMAGES = 40;
    /**
     * clientRequestId 只收 8–64 个 {@code [A-Za-z0-9_-]}：不许「:」—— 批量出图的子项键是 {@code ${id}:${序号}}，
     * 客户端造不出来，两个命名空间就不会撞（列宽 80 = 64 + 「:」+ 序号）。
     */
    static final java.util.regex.Pattern CLIENT_REQUEST_ID = java.util.regex.Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    /** 视频模型时长上限未知时按这个算。 */
    static final int DEFAULT_MAX_SEGMENT_SEC = 10;
    /**
     * 画布片段视频在 material_video_job 里的 kind。和老短剧同一个分区（APP_DRAMA，存储记账、归属都按 drama 走），
     * 老工作台列任务时按这个 kind 排除（{@link #isCanvasVideoJob}），两边互不可见。
     */
    public static final String VIDEO_JOB_KIND = "drama-canvas";

    /** 视频任务卡（MaterialVideo 形状）是不是画布的 —— 老短剧工作台 / 任务中心列表用它排除。 */
    public static boolean isCanvasVideoJob(JsonNode card) {
        return card != null && VIDEO_JOB_KIND.equals(card.path("kind").asText(null));
    }

    private final DramaCanvasRunRepository runs;
    private final DramaCanvasService canvases;
    private final DramaCanvasOwnership ownership;
    private final DramaCanvasPromptBuilder builder;
    private final DramaCanvasRunWorker worker;
    private final DramaRenderService render;
    private final PlatformConfigService configs;
    private final CreditService credits;
    private final AiModelInvocationService invocation;
    private final MaterialVideoJobService videoJobs;
    private final MaterialVideoModelClient videoModels;
    private final StorageQuotaService storage;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;
    private final TransactionTemplate tx;

    public DramaCanvasRunService(DramaCanvasRunRepository runs,
                                 DramaCanvasService canvases,
                                 DramaCanvasOwnership ownership,
                                 DramaCanvasPromptBuilder builder,
                                 DramaCanvasRunWorker worker,
                                 DramaRenderService render,
                                 PlatformConfigService configs,
                                 CreditService credits,
                                 AiModelInvocationService invocation,
                                 MaterialVideoJobService videoJobs,
                                 MaterialVideoModelClient videoModels,
                                 StorageQuotaService storage,
                                 CdnUrlSigner signer,
                                 ObjectMapper om,
                                 PlatformTransactionManager txManager) {
        this.runs = runs;
        this.canvases = canvases;
        this.ownership = ownership;
        this.builder = builder;
        this.worker = worker;
        this.render = render;
        this.configs = configs;
        this.credits = credits;
        this.invocation = invocation;
        this.videoJobs = videoJobs;
        this.videoModels = videoModels;
        this.storage = storage;
        this.signer = signer;
        this.om = om;
        this.tx = new TransactionTemplate(txManager);
    }

    /** 提交时读出的画布与库里那份文档。 */
    private record Ctx(String userId, DramaCanvas canvas, JsonNode doc) {}

    // ═════════════════════════════════════════════════════════════════════════
    // 文字类：script / extract / storyboard
    // ═════════════════════════════════════════════════════════════════════════

    public DramaCanvasRunDto submitScript(String userId, String canvasId, CanvasScriptRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, scriptTarget(body), () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            String stage = body.stage() == null ? "" : body.stage().trim().toLowerCase(java.util.Locale.ROOT);
            DramaCanvasPromptBuilder.TextPlan plan;
            long price;
            switch (stage) {
                case "setting" -> {
                    plan = builder.setting(c.doc(), body.instruction());
                    price = configs.getLong(DramaConfigSeeder.KEY_CANVAS_SCRIPT_SETTING,
                            DramaConfigSeeder.DEFAULT_CANVAS_SCRIPT_SETTING);
                }
                case "outline" -> {
                    plan = builder.outline(c.doc(), body.instruction());
                    price = configs.getLong(DramaConfigSeeder.KEY_CANVAS_SCRIPT_OUTLINE,
                            DramaConfigSeeder.DEFAULT_CANVAS_SCRIPT_OUTLINE);
                }
                case "episode" -> {
                    plan = builder.episode(c.doc(), body.episodeNo(), body.instruction());
                    price = configs.getLong(DramaConfigSeeder.KEY_CANVAS_SCRIPT_EPISODE,
                            DramaConfigSeeder.DEFAULT_CANVAS_SCRIPT_EPISODE);
                }
                default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_STAGE_INVALID",
                        "要写的是故事大纲、分集剧情还是某一集剧本？");
            }
            requireLlm();
            return List.of(textRun(c, cri, DramaCanvasRun.KIND_SCRIPT, plan, price));
        });
    }

    public DramaCanvasRunDto submitExtract(String userId, String canvasId, CanvasExtractRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, "extract", () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            DramaCanvasPromptBuilder.TextPlan plan = builder.extract(c.doc());
            requireLlm();
            long price = configs.getLong(DramaConfigSeeder.KEY_CANVAS_EXTRACT, DramaConfigSeeder.DEFAULT_CANVAS_EXTRACT);
            return List.of(textRun(c, cri, DramaCanvasRun.KIND_EXTRACT, plan, price));
        });
    }

    public DramaCanvasRunDto submitStoryboard(String userId, String canvasId, CanvasStoryboardRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, "storyboard:" + body.episodeNo(), () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            int maxSec = clamp(body.maxSegmentSec() == null ? DEFAULT_MAX_SEGMENT_SEC : body.maxSegmentSec(), 4, 30);
            DramaCanvasPromptBuilder.TextPlan plan = builder.storyboard(c.doc(), body.episodeNo(), maxSec);
            requireLlm();
            long price = configs.getLong(DramaConfigSeeder.KEY_CANVAS_STORYBOARD, DramaConfigSeeder.DEFAULT_CANVAS_STORYBOARD);
            return List.of(textRun(c, cri, DramaCanvasRun.KIND_STORYBOARD, plan, price));
        });
    }

    private DramaCanvasRun textRun(Ctx c, String cri, String kind, DramaCanvasPromptBuilder.TextPlan plan, long price) {
        String runId = newRunId();
        ObjectNode input = om.createObjectNode();
        input.put("target", plan.target());
        ObjectNode exec = input.putObject("_exec");
        exec.put("unitCost", price);
        exec.put("holdTotal", price);
        exec.put("holdRef", runId);
        exec.put("label", plan.label());
        exec.put("promptKey", plan.promptKey());
        ArrayNode calls = exec.putArray("calls");
        for (DramaCanvasPromptBuilder.TextCall tc : plan.calls()) {
            calls.addObject()
                    .put("system", tc.system())
                    .put("user", tc.user())
                    .put("temperature", tc.temperature())
                    .put("maxTokens", tc.maxTokens())
                    .put("jsonMode", tc.jsonMode());
        }
        exec.set("meta", plan.meta());

        if (price > 0) {
            // 余额不足在这里抛 402，事务回滚、记录不落库
            credits.hold(c.userId(), price, REF_TYPE, runId, plan.label());
        }
        DramaCanvasRun run = newRun(runId, c, cri, kind, plan.target(), price, input, null);
        runs.saveAndFlush(run);
        log.info("[drama-canvas] 运行受理 run={} canvas={} kind={} target={} calls={} hold={}",
                runId, run.getCanvasId(), kind, plan.target(), plan.calls().size(), price);
        afterCommit(() -> worker.dispatch(List.of(runId)));
        return run;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 出图：image / image-batch
    // ═════════════════════════════════════════════════════════════════════════

    public DramaCanvasRunDto submitImage(String userId, String canvasId, CanvasImageRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, imageTarget(body.target()), () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            int count = imageCount(body.count());
            DramaRenderService.ImagePlan plan = render.resolveImagePlan(body.endpointId(), "出图");
            DramaCanvasPromptBuilder.ImageCompile ic = builder.image(c.doc(), c.canvas().getRatio(), body.target(),
                    body.ratio(), plan.maxRefImages(), this::deliverable, render::fillMediaPrompt);
            ownership.requireOwned(userId, ic.requestedKeys());
            storage.checkQuota("drama", userId, 0);
            long total = multiply(plan.cost(), count);
            String runId = newRunId();
            if (total > 0) {
                credits.hold(userId, total, REF_TYPE, runId, ic.label() + " ×" + count);
            }
            DramaCanvasRun run = imageRun(runId, c, cri, ic, plan, body.endpointId(), count, runId, total, null);
            runs.saveAndFlush(run);
            log.info("[drama-canvas] 出图受理 run={} canvas={} target={} count={} refs={}/{} hold={}",
                    runId, canvasId, ic.target(), count, ic.appliedKeys().size(), ic.requestedKeys().size(), total);
            afterCommit(() -> worker.dispatch(List.of(runId)));
            return List.of(run);
        });
    }

    /**
     * 批量出图：一次报总价、<b>一次冻结</b>（整批一个 hold）；每项一条运行记录（幂等键 {@code ${clientRequestId}:${index}}），
     * worker 按顺序逐张出、逐张结算，整批跑完把没用掉的冻结一次退回。
     */
    public List<DramaCanvasRunDto> submitImageBatch(String userId, String canvasId, CanvasImageBatchBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        List<CanvasImageBatchItem> items = body.items();
        if (items == null || items.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_BATCH_EMPTY", "先选要出图的造型或场景。");
        }
        if (items.size() > MAX_BATCH_ITEMS) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_BATCH_TOO_LARGE",
                    "一次最多给 " + MAX_BATCH_ITEMS + " 项出图，分几次来。");
        }
        int totalImages = 0;
        for (CanvasImageBatchItem it : items) totalImages += it == null ? 0 : imageCount(it.count());
        if (totalImages > MAX_BATCH_IMAGES) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_BATCH_TOO_LARGE",
                    "一次最多出 " + MAX_BATCH_IMAGES + " 张图（这次选了 " + totalImages + " 张），分几次来。");
        }
        Optional<List<DramaCanvasRun>> hit = existingBatch(userId, canvasId, cri);
        if (hit.isPresent()) return toDtos(userId, hit.get());
        try {
            List<DramaCanvasRun> created = tx.execute(s -> {
                Ctx c = load(userId, canvasId, body.docVersion());
                DramaRenderService.ImagePlan plan = render.resolveImagePlan(body.endpointId(), "出图");
                List<DramaCanvasPromptBuilder.ImageCompile> compiled = new ArrayList<>();
                List<Integer> counts = new ArrayList<>();
                Set<String> allKeys = new LinkedHashSet<>();
                long total = 0;
                int images = 0;
                for (CanvasImageBatchItem it : items) {
                    if (it == null) throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给谁出图？");
                    int count = imageCount(it.count());
                    DramaCanvasPromptBuilder.ImageCompile ic = builder.image(c.doc(), c.canvas().getRatio(), it.target(),
                            it.ratio(), plan.maxRefImages(), this::deliverable, render::fillMediaPrompt);
                    compiled.add(ic);
                    counts.add(count);
                    allKeys.addAll(ic.requestedKeys());
                    total = Math.addExact(total, multiply(plan.cost(), count));
                    images += count;
                }
                ownership.requireOwned(userId, allKeys);
                storage.checkQuota("drama", userId, 0);

                List<String> runIds = new ArrayList<>();
                for (int i = 0; i < items.size(); i++) runIds.add(newRunId());
                String holdRef = batchHoldRefOf(runIds.get(0));
                if (total > 0) {
                    credits.hold(userId, total, REF_TYPE, holdRef,
                            "画布 · 批量出图（" + items.size() + " 项 · " + images + " 张）");
                }
                List<DramaCanvasRun> out = new ArrayList<>();
                for (int i = 0; i < items.size(); i++) {
                    long share = multiply(plan.cost(), counts.get(i));
                    // 第 0 项占用原始键（和单条生成抢同一把唯一索引），其余 ${键}:${序号}（客户端造不出「:」）
                    String itemKey = i == 0 ? cri : cri + ":" + i;
                    DramaCanvasRun run = imageRun(runIds.get(i), c, itemKey, compiled.get(i), plan,
                            body.endpointId(), counts.get(i), holdRef, share, runIds);
                    runs.saveAndFlush(run);
                    out.add(run);
                }
                log.info("[drama-canvas] 批量出图受理 canvas={} items={} images={} hold={} ref={}",
                        canvasId, items.size(), images, total, holdRef);
                afterCommit(() -> worker.dispatchBatch(runIds, holdRef));
                return out;
            });
            return toDtos(userId, reloadAll(created));
        } catch (DataIntegrityViolationException e) {
            Optional<List<DramaCanvasRun>> again = existingBatch(userId, canvasId, cri);
            if (again.isPresent()) return toDtos(userId, again.get());
            throw e;
        }
    }

    private DramaCanvasRun imageRun(String runId, Ctx c, String cri, DramaCanvasPromptBuilder.ImageCompile ic,
                                    DramaRenderService.ImagePlan plan, String endpointId, int count,
                                    String holdRef, long holdTotal, List<String> batchRunIds) {
        ObjectNode input = om.createObjectNode();
        input.put("target", ic.target());
        ObjectNode exec = input.putObject("_exec");
        exec.put("unitCost", plan.cost());
        exec.put("count", count);
        exec.put("holdTotal", holdTotal);
        exec.put("holdRef", holdRef);
        exec.put("label", ic.label());
        if (endpointId != null && !endpointId.isBlank()) exec.put("endpointId", endpointId.trim());
        exec.put("promptKey", ic.promptKey());
        exec.put("prompt", ic.prompt());
        exec.put("ratio", ic.ratio());
        exec.put("keyPrefix", ic.keyPrefix());
        ArrayNode refKeys = exec.putArray("refKeys");
        ic.appliedKeys().forEach(refKeys::add);
        if (batchRunIds != null) {
            ArrayNode ids = exec.putArray("batchRunIds");
            batchRunIds.forEach(ids::add);
        }
        DramaCanvasRunDto.Refs refs = new DramaCanvasRunDto.Refs(ic.requestedKeys().size(), ic.appliedKeys().size(),
                ic.notes());
        return newRun(runId, c, cri, DramaCanvasRun.KIND_IMAGE, ic.target(), holdTotal, input, refs);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 视频
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * 片段出视频：首帧（片段挑中的那张，过归属闸）写进 {@code variant_config.first_frame_key}（聚算 H3 只认它），
     * 同时（地址模型取得到时）拼进提示词标记（seedance / generic 从标记里抽）。冻结 / 结算 / 退回由
     * {@code MaterialVideoJobService} 负责（提交即冻结，worker 结算或退回），运行记录只存 jobId。
     */
    public DramaCanvasRunDto submitVideo(String userId, String canvasId, CanvasVideoRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, "video:" + body.episodeNo() + ":" + trim(body.segmentId()), () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            if (body.episodeNo() == null || body.segmentId() == null || body.segmentId().isBlank()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TARGET_INVALID", "要给哪个片段生成视频？");
            }
            int no = body.episodeNo();
            String segId = body.segmentId().trim();
            JsonNode seg = DramaCanvasDocs.findSegment(c.doc(), no, segId)
                    .orElseThrow(() -> BusinessException.notFound("DRAMA_CANVAS_SEGMENT_NOT_FOUND", "找不到这个片段，刷新后再试。"));
            JsonNode d = seg.get("durationSec");
            if (d == null || !d.isNumber() || d.asInt() < 1) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SEGMENT_DURATION_INVALID",
                        "这个片段还没有时长，先在每个镜头开头写上「（N 秒）」。");
            }
            int durationSec = d.asInt();
            String segText = DramaCanvasDocs.stripRefs(DramaCanvasDocs.text(seg, "text")).strip();
            if (segText.isEmpty()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_PROMPT_EMPTY",
                        "先写这个片段的分镜脚本，再生成视频。");
            }

            // 时长上限（协议 ∩ 候选；未知按 10 秒）—— 超了是 400 且不冻结
            String endpointId = body.endpointId() == null || body.endpointId().isBlank() ? null : body.endpointId().trim();
            AiModelInvocationService.ResolvedEndpoint re = endpointId != null
                    ? invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, endpointId)
                            .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "ENDPOINT_NOT_ALLOWED",
                                    "选的模型现在用不了，刷新页面后重新选一个。"))
                    : invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION, null)
                            .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_NOT_CONFIGURED",
                                    "生成视频还没接入视频模型：请在管理后台为「视频生成」用途绑定一个模型端点后再试。"));
            MaterialVideoModelClient.DurationBounds bounds = videoModels.effectiveDurationBounds(endpointId, re.endpoint());
            int maxSec = bounds.maxSec() != null ? bounds.maxSec() : DEFAULT_MAX_SEGMENT_SEC;
            if (durationSec > maxSec) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SEGMENT_TOO_LONG",
                        "这个视频模型一条最长 " + maxSec + " 秒，这个片段 " + durationSec + " 秒，拆短一点再生成。",
                        Map.of("maxSec", maxSec, "durationSec", durationSec));
            }
            if (bounds.minSec() != null && durationSec < bounds.minSec()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_SEGMENT_TOO_SHORT",
                        "这个视频模型一条至少 " + bounds.minSec() + " 秒，这个片段只有 " + durationSec + " 秒，写长一点再生成。",
                        Map.of("minSec", bounds.minSec(), "durationSec", durationSec));
            }
            DramaRenderService.ClipPlan plan = render.resolveClipPlan(endpointId, durationSec);

            String ratio = c.canvas().getRatio();
            String prompt = render.fillMediaPrompt(PromptService.KEY_DRAMA_CANVAS_SEGMENT_VIDEO,
                    DramaCanvasPromptBuilder.videoVars(c.doc(), seg, ratio), "canvas-segment");

            // 首帧：片段挑中的那张；非本人的 key → 400 且不冻结（不是「跳过这一张」）
            List<String> notes = new ArrayList<>();
            boolean wantFirstFrame = body.useFirstFrame() == null || body.useFirstFrame();
            String frameKey = wantFirstFrame ? DramaCanvasDocs.pickedImageKey(seg.path("frame")).orElse(null) : null;
            String firstFrameKey = null;
            String markerUrl = null;
            int requested = 0;
            int applied = 0;
            if (frameKey == null) {
                notes.add("没有首帧，角色长相可能对不上。");
            } else {
                ownership.requireOwned(userId, List.of(frameKey));
                requested = 1;
                if (!plan.acceptsFirstFrame()) {
                    notes.add("这个模型不看首帧，角色长相可能对不上。");
                } else {
                    firstFrameKey = frameKey;
                    String url = signer.signKey(frameKey);
                    boolean fetchable = url != null && DramaReferenceAssembler.isFetchableImageRef(url);
                    // 聚算 H3 由服务端按 key 读图上传，不依赖地址能不能被外部访问
                    boolean keyProtocol = videoModels.videoGeometry(re.endpoint()) != null;
                    if (fetchable) markerUrl = url;
                    if (fetchable || keyProtocol) {
                        applied = 1;
                    } else {
                        notes.add("首帧的地址模型取不到（本地开发环境），这次没用上首帧。");
                    }
                }
            }
            storage.checkQuota("drama", userId, 0);

            String runId = newRunId();
            ObjectNode vc = om.createObjectNode();
            vc.put("target", "canvas-segment");
            vc.put("canvas_id", c.canvas().getId());
            vc.put("canvas_run_id", runId);
            vc.put("episode_no", no);
            vc.put("segment_id", segId);
            // 画布只存 key：成片镜像不进我方存储就判失败并退回冻结（MaterialVideoWorker 按任务生效的开关）
            vc.put("require_mirror", true);
            String name = "第 " + no + " 集 · 片段 " + (segmentIndex(c.doc(), no, segId) + 1);
            JsonNode card = render.submitClip(plan, new DramaRenderService.ClipSubmission(VIDEO_JOB_KIND, name,
                    "短剧画布 · 片段视频", prompt, markerUrl, null, firstFrameKey, durationSec, ratio,
                    c.canvas().getId(), vc), userId);
            String jobId = card == null ? null : DramaCanvasDocs.text(card, "id");
            if (jobId == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "DRAMA_CANVAS_VIDEO_SUBMIT_FAILED",
                        "视频任务没建起来，没有扣费，稍后再试一次。");
            }

            ObjectNode input = om.createObjectNode();
            input.put("target", "video:" + no + ":" + segId);
            ObjectNode exec = input.putObject("_exec");
            exec.put("unitCost", plan.cost());
            exec.put("durationSec", durationSec);
            if (endpointId != null) exec.put("endpointId", endpointId);
            exec.put("prompt", prompt);
            if (firstFrameKey != null) exec.put("firstFrameKey", firstFrameKey);
            exec.put("jobId", jobId);
            DramaCanvasRun run = newRun(runId, c, cri, DramaCanvasRun.KIND_VIDEO, "video:" + no + ":" + segId,
                    plan.cost(), input, new DramaCanvasRunDto.Refs(requested, applied, notes));
            run.setJobId(jobId);
            runs.saveAndFlush(run);
            log.info("[drama-canvas] 视频受理 run={} job={} canvas={} ep={} seg={} dur={}s cost={} firstFrame={}/{}",
                    runId, jobId, canvasId, no, segId, durationSec, plan.cost(), applied, requested);
            // 不另派发：MaterialVideoJobService.submit 自己在 afterCommit 里派发它的 worker；状态在查询时同步
            return List.of(run);
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 合成
    // ═════════════════════════════════════════════════════════════════════════

    /** 合成成片（免费）：这一集每个片段挑中的视频按片段顺序拼接；有片段没视频 → 400，一个都不拼。 */
    public DramaCanvasRunDto submitAssemble(String userId, String canvasId, CanvasAssembleRunBody body) {
        if (body == null) throw bodyRequired();
        String cri = requireClientRequestId(body.clientRequestId());
        return single(userId, canvasId, cri, "assemble:" + body.episodeNo(), () -> {
            Ctx c = load(userId, canvasId, body.docVersion());
            if (body.episodeNo() == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_EPISODE_REQUIRED", "要合成哪一集？");
            }
            int no = body.episodeNo();
            JsonNode ep = DramaCanvasDocs.findEpisode(c.doc(), no)
                    .orElseThrow(() -> BusinessException.notFound("DRAMA_CANVAS_EPISODE_NOT_FOUND", "找不到第 " + no + " 集。"));
            List<String> keys = new ArrayList<>();
            List<Integer> missing = new ArrayList<>();
            List<String> missingIds = new ArrayList<>();
            int i = 0;
            for (JsonNode seg : DramaCanvasDocs.arr(ep, "segments")) {
                i++;
                Optional<String> k = DramaCanvasDocs.pickedVideo(seg.path("video")).map(v -> DramaCanvasDocs.text(v, "key"));
                if (k.isPresent() && k.get() != null) {
                    keys.add(k.get());
                } else {
                    missing.add(i);
                    String sid = DramaCanvasDocs.text(seg, "id");
                    if (sid != null) missingIds.add(sid);
                }
            }
            if (i == 0) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_NOTHING_TO_ASSEMBLE",
                        "第 " + no + " 集还没有片段，先生成分镜脚本和片段视频。");
            }
            if (!missing.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (Integer m : missing) sb.append(sb.length() == 0 ? "" : "、").append(m);
                throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_NOTHING_TO_ASSEMBLE",
                        "第 " + sb + " 个片段还没有视频，都生成好了再合成。",
                        Map.of("segmentIds", missingIds));
            }
            ownership.requireOwned(userId, keys);
            storage.checkQuota("drama", userId, 0);

            String runId = newRunId();
            ObjectNode input = om.createObjectNode();
            input.put("target", "assemble:" + no);
            ObjectNode exec = input.putObject("_exec");
            exec.put("episodeNo", no);
            ArrayNode vk = exec.putArray("videoKeys");
            keys.forEach(vk::add);
            DramaCanvasRun run = newRun(runId, c, cri, DramaCanvasRun.KIND_ASSEMBLE, "assemble:" + no, 0, input, null);
            runs.saveAndFlush(run);
            log.info("[drama-canvas] 合成受理 run={} canvas={} ep={} clips={}", runId, canvasId, no, keys.size());
            afterCommit(() -> worker.dispatch(List.of(runId)));
            return List.of(run);
        });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 查询 / 取消
    // ═════════════════════════════════════════════════════════════════════════

    /** GET runs?ids=a,b,c：只返回本人、本画布的（最多 50 个，按请求顺序）；视频类返回前按任务同步一次。 */
    public List<DramaCanvasRunDto> list(String userId, String canvasId, String idsCsv) {
        canvases.requireCanvas(userId, canvasId);
        List<String> ids = new ArrayList<>();
        if (idsCsv != null) {
            for (String s : idsCsv.split(",")) {
                String t = s.trim();
                if (!t.isEmpty() && !ids.contains(t)) ids.add(t);
            }
        }
        if (ids.isEmpty()) return List.of();
        if (ids.size() > MAX_QUERY_IDS) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_TOO_MANY_RUN_IDS",
                    "一次最多查 " + MAX_QUERY_IDS + " 条。");
        }
        Map<String, DramaCanvasRun> byId = new HashMap<>();
        for (DramaCanvasRun r : runs.findByOwnerUserIdAndCanvasIdAndIdIn(userId, canvasId, ids)) {
            byId.put(r.getId(), refreshVideo(r));
        }
        List<DramaCanvasRun> ordered = new ArrayList<>();
        for (String id : ids) {
            DramaCanvasRun r = byId.get(id);
            if (r != null) ordered.add(r);
        }
        return toDtos(userId, ordered);
    }

    /**
     * 按幂等键只查不建（GET runs/lookup?clientRequestId=）：请求发出后响应丢了 / 页面提前离开，下次进页用它确认
     * 「当初到底受理了没有」—— 前端<b>不许</b>用原键重发 POST 来确认（没受理过的请求重发一次就是一笔新扣费）。
     *
     * <p>单条命中 → [那一条]；命中的是批量出图第 0 项 → 按它的 batchRunIds 返回整批；没有 → []。
     * 命中的记录不在这张画布上 → []（不暴露别的画布）。视频类返回前照 GET runs 的规则同步一次状态。
     * 没有副作用：不校验 docVersion、不冻结、不派发。
     */
    public List<DramaCanvasRunDto> lookup(String userId, String canvasId, String clientRequestId) {
        String cri = requireClientRequestId(clientRequestId);
        canvases.requireCanvas(userId, canvasId);
        DramaCanvasRun hit = runs.findByOwnerUserIdAndClientRequestId(userId, cri).orElse(null);
        if (hit == null || !canvasId.equals(hit.getCanvasId())) return List.of();
        List<String> batchIds = new ArrayList<>();
        for (JsonNode n : worker.execOf(hit).path("batchRunIds")) batchIds.add(n.asText());
        List<DramaCanvasRun> found = new ArrayList<>();
        if (!batchIds.isEmpty() && batchIds.get(0).equals(hit.getId())) {
            Map<String, DramaCanvasRun> byId = new HashMap<>();
            for (DramaCanvasRun r : runs.findByOwnerUserIdAndCanvasIdAndIdIn(userId, canvasId, batchIds)) byId.put(r.getId(), r);
            for (String id : batchIds) if (byId.containsKey(id)) found.add(refreshVideo(byId.get(id)));
        } else {
            found.add(refreshVideo(hit));
        }
        return toDtos(userId, found);
    }

    /** 视频：在途的按任务同步；已失败的也再核对一次（管理端对账恢复成功后改回成功，只读原任务不重提）。 */
    private DramaCanvasRun refreshVideo(DramaCanvasRun r) {
        boolean check = DramaCanvasRun.KIND_VIDEO.equals(r.getKind())
                && (!r.isTerminal() || DramaCanvasRun.STATUS_FAILED.equals(r.getStatus()));
        return check ? worker.syncVideo(r) : r;
    }

    /**
     * 取消：只有 queued 且还没交给厂商的能取消（退回冻结，status=canceled）；已经开始的 409
     * {@code DRAMA_CANVAS_RUN_NOT_CANCELABLE}。批量出图里的一项：标成 canceled，它那份冻结在整批跑完时一起退回。
     */
    public DramaCanvasRunDto cancel(String userId, String canvasId, String runId) {
        canvases.requireCanvas(userId, canvasId);
        DramaCanvasRun run = runs.findByIdAndOwnerUserIdAndCanvasId(runId, userId, canvasId)
                .orElseThrow(() -> BusinessException.notFound("DRAMA_CANVAS_RUN_NOT_FOUND", "找不到这次生成。"));
        boolean video = DramaCanvasRun.KIND_VIDEO.equals(run.getKind());
        if (video && !run.isTerminal()) run = worker.syncVideo(run);
        final DramaCanvasRun target = run;
        // 取消（条件：仍 queued）与退款同一事务；worker 抢先认领了 → 影响 0 行 → 409，一分钱不动
        Boolean ok = tx.execute(s -> {
            OffsetDateTime now = OffsetDateTime.now();
            if (video) {
                if (!DramaCanvasRun.STATUS_QUEUED.equals(target.getStatus())
                        || !videoJobs.cancelQueued(target.getJobId(), userId)) {
                    return false; // 视频冻结在视频任务上，cancelQueued 已经在这个事务里退了
                }
                if (runs.cancel(target.getId(), List.of(DramaCanvasRun.STATUS_QUEUED), "已取消", now) != 1) {
                    s.setRollbackOnly();
                    return false;
                }
                return true;
            }
            if (runs.cancel(target.getId(), List.of(DramaCanvasRun.STATUS_QUEUED), "已取消", now) != 1) return false;
            JsonNode exec = worker.execOf(target);
            // 批量出图的一项：共用冻结在整批跑完时一起退（worker 会跳过这项）
            if (!exec.has("batchRunIds")) {
                credits.releaseHold(REF_TYPE, exec.path("holdRef").asText(target.getId()), "画布 · 已取消，退回冻结");
            }
            return true;
        });
        if (!Boolean.TRUE.equals(ok)) throw notCancelable();
        log.info("[drama-canvas] 运行已取消 run={} kind={}", target.getId(), target.getKind());
        return toDtos(userId, List.of(reload(target))).get(0);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 出 wire
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * 运行记录 → DTO。result 里的资产只给<b>属于本人</b>的 key 派生签名地址（一次批量查归属，不 N+1）；
     * 不是本人的 key（理论上不会有 —— 都是服务端自己写的）不签、原样留 key。
     */
    List<DramaCanvasRunDto> toDtos(String userId, List<DramaCanvasRun> list) {
        Map<String, JsonNode> results = new LinkedHashMap<>();
        Set<String> keys = new LinkedHashSet<>();
        for (DramaCanvasRun r : list) {
            if (!DramaCanvasRun.STATUS_SUCCEEDED.equals(r.getStatus()) || r.getResultJson() == null) continue;
            JsonNode res = parse(r.getResultJson());
            if (res == null) continue;
            results.put(r.getId(), res);
            DramaCanvasDocs.collectAssetKeys(res, keys);
        }
        Set<String> owned = keys.isEmpty() ? Set.of() : ownership.ownedKeys(userId, keys);
        List<DramaCanvasRunDto> out = new ArrayList<>();
        for (DramaCanvasRun r : list) {
            JsonNode res = results.get(r.getId());
            if (res != null) decorateUrls(res, owned);
            out.add(new DramaCanvasRunDto(
                    r.getId(), r.getCanvasId(), r.getKind(), r.getTarget(), r.getStatus(), r.getCost(),
                    res, parseRefs(r.getRefsJson()), blankToNull(r.getErrorCode()), blankToNull(r.getErrorMessage()),
                    iso(r.getCreatedAt()), iso(r.getFinishedAt())));
        }
        return out;
    }

    private void decorateUrls(JsonNode node, Set<String> owned) {
        if (node == null) return;
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            String k = DramaCanvasDocs.text(o, "key");
            if (k != null && owned.contains(k)) {
                String u = signer.signKey(k);
                if (u != null) o.put("url", u);
            }
            String lf = DramaCanvasDocs.text(o, "lastFrameKey");
            if (lf != null && owned.contains(lf)) {
                String u = signer.signKey(lf);
                if (u != null) o.put("lastFrameUrl", u);
            }
            o.elements().forEachRemaining(child -> decorateUrls(child, owned));
        } else if (node.isArray()) {
            node.forEach(child -> decorateUrls(child, owned));
        }
    }

    private DramaCanvasRunDto.Refs parseRefs(String json) {
        JsonNode n = parse(json);
        if (n == null || !n.isObject()) return null;
        List<String> notes = new ArrayList<>();
        for (JsonNode s : n.path("notes")) if (s.isTextual()) notes.add(s.asText());
        return new DramaCanvasRunDto.Refs(n.path("requested").asInt(0), n.path("applied").asInt(0), notes);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 内部
    // ═════════════════════════════════════════════════════════════════════════

    /** 单条提交的幂等外壳：先查 → 事务里做（preflight / 冻结 / 落库 / 登记 afterCommit）→ 撞唯一键回查。 */
    private DramaCanvasRunDto single(String userId, String canvasId, String cri, String expectedTarget,
                                     Supplier<List<DramaCanvasRun>> work) {
        Optional<DramaCanvasRun> hit = existingSingle(userId, canvasId, cri, expectedTarget);
        if (hit.isPresent()) return toDtos(userId, List.of(hit.get())).get(0);
        try {
            List<DramaCanvasRun> created = tx.execute(s -> work.get());
            // 重读：afterCommit 里派发被拒（队列满）时，那条已经在新事务里判失败并退款 —— 返回它现在的样子
            return toDtos(userId, reloadAll(created)).get(0);
        } catch (DataIntegrityViolationException e) {
            Optional<DramaCanvasRun> again = existingSingle(userId, canvasId, cri, expectedTarget);
            if (again.isPresent()) {
                log.info("[drama-canvas] 并发重复提交，回原记录 run={} cri={}", again.get().getId(), cri);
                return toDtos(userId, List.of(again.get())).get(0);
            }
            throw e;
        }
    }

    private Optional<DramaCanvasRun> existing(String userId, String canvasId, String cri) {
        Optional<DramaCanvasRun> hit = runs.findByOwnerUserIdAndClientRequestId(userId, cri);
        if (hit.isPresent() && !hit.get().getCanvasId().equals(canvasId)) throw requestIdReused();
        return hit;
    }

    /**
     * 单条生成的重试：同一个键已有的记录必须是<b>同一种请求</b>（target 相同、不是批量的一项），否则 409 ——
     * 别把「写故事大纲」的旧记录当成「出这张图」的结果返回。
     */
    private Optional<DramaCanvasRun> existingSingle(String userId, String canvasId, String cri, String expectedTarget) {
        Optional<DramaCanvasRun> hit = existing(userId, canvasId, cri);
        if (hit.isPresent()
                && (expectedTarget == null || !expectedTarget.equals(hit.get().getTarget())
                || worker.execOf(hit.get()).has("batchRunIds"))) {
            throw requestIdReused();
        }
        return hit;
    }

    /**
     * 批量出图的重试：原始键上的那条必须是本画布、出图、而且是这一批的第 0 项，否则键被别的请求占了 → 409；
     * 然后按第 0 项里记着的 batchRunIds 收齐兄弟项。
     */
    private Optional<List<DramaCanvasRun>> existingBatch(String userId, String canvasId, String cri) {
        Optional<DramaCanvasRun> first = existing(userId, canvasId, cri);
        if (first.isEmpty()) return Optional.empty();
        List<String> ids = new ArrayList<>();
        for (JsonNode n : worker.execOf(first.get()).path("batchRunIds")) ids.add(n.asText());
        if (!DramaCanvasRun.KIND_IMAGE.equals(first.get().getKind()) || ids.isEmpty()
                || !ids.get(0).equals(first.get().getId())) {
            throw requestIdReused();
        }
        Map<String, DramaCanvasRun> byId = new HashMap<>();
        for (DramaCanvasRun r : runs.findByOwnerUserIdAndCanvasIdAndIdIn(userId, canvasId, ids)) byId.put(r.getId(), r);
        List<DramaCanvasRun> out = new ArrayList<>();
        for (String id : ids) if (byId.containsKey(id)) out.add(byId.get(id));
        return Optional.of(out);
    }

    private Ctx load(String userId, String canvasId, String docVersion) {
        DramaCanvas canvas = canvases.requireCanvas(userId, canvasId);
        canvases.requireVersion(canvas, docVersion);
        return new Ctx(userId, canvas, canvases.readDoc(canvas));
    }

    private void requireLlm() {
        if (!invocation.hasEndpointFor(AiModelPurpose.DRAMA_SCRIPT_DRAFT)) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                    "AI 写作还没接入大模型：请在管理后台为「短剧脚本起草」用途绑定一个模型端点后再试。");
        }
    }

    /** 这个 key 派生出的地址，外部图像模型取不取得到（本地开发环境的 /cdn 相对地址取不到）。 */
    private boolean deliverable(String key) {
        String url = signer.signKey(key);
        return url != null && DramaReferenceAssembler.isFetchableImageRef(url);
    }

    private DramaCanvasRun newRun(String runId, Ctx c, String cri, String kind, String target, long cost,
                                  ObjectNode input, DramaCanvasRunDto.Refs refs) {
        OffsetDateTime now = OffsetDateTime.now();
        return DramaCanvasRun.builder()
                .id(runId)
                .canvasId(c.canvas().getId())
                .ownerUserId(c.userId())
                .kind(kind)
                .target(target)
                .status(DramaCanvasRun.STATUS_QUEUED)
                .cost(cost)
                .clientRequestId(cri)
                .inputJson(write(input))
                .refsJson(refs == null ? null : write(om.valueToTree(refs)))
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    private DramaCanvasRun reload(DramaCanvasRun run) {
        return runs.findById(run.getId()).orElse(run);
    }

    private void afterCommit(Runnable r) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    r.run();
                }
            });
        } else {
            r.run();
        }
    }

    private static int segmentIndex(JsonNode doc, int no, String segId) {
        int i = 0;
        for (JsonNode s : DramaCanvasDocs.findEpisode(doc, no).map(e -> DramaCanvasDocs.arr(e, "segments"))
                .orElse(DramaCanvasDocs.arr(null, "segments"))) {
            if (segId.equals(DramaCanvasDocs.text(s, "id"))) return i;
            i++;
        }
        return 0;
    }

    static String requireClientRequestId(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (!CLIENT_REQUEST_ID.matcher(s).matches()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_REQUEST_ID_INVALID",
                    "请求缺少有效的 clientRequestId，刷新页面后再试。");
        }
        return s;
    }

    private static int imageCount(Integer raw) {
        int n = raw == null ? 1 : raw;
        if (n < 1 || n > 4) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_COUNT_INVALID", "一次出 1 到 4 张。");
        }
        return n;
    }

    private static long multiply(long unit, int count) {
        try {
            return Math.multiplyExact(Math.max(0, unit), count);
        } catch (ArithmeticException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_PRICE_OVERFLOW", "积分算不出来，请联系平台。");
        }
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static BusinessException bodyRequired() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_CANVAS_BODY_INVALID", "请求内容是空的。");
    }

    private static BusinessException requestIdReused() {
        return new BusinessException(HttpStatus.CONFLICT, "DRAMA_CANVAS_REQUEST_ID_REUSED",
                "这个请求编号已经被别的生成用过了，刷新页面后再试。");
    }

    /**
     * 批量出图共用冻结的引用，由第 0 项的 id 派生（dcr_xxx → dcb_xxx）：回收器从一个 ACTIVE 的 hold 就能找回这一批
     * （{@link #batchLeadRunIdOf}），补退「整批都终态了、共用冻结却没退掉」的那种。
     */
    static String batchHoldRefOf(String leadRunId) {
        return "dcb_" + leadRunId.substring("dcr_".length());
    }

    /** {@link #batchHoldRefOf} 的反方向；不是批量冻结的引用 → null。 */
    static String batchLeadRunIdOf(String holdRef) {
        return holdRef != null && holdRef.startsWith("dcb_") ? "dcr_" + holdRef.substring("dcb_".length()) : null;
    }

    private static String scriptTarget(CanvasScriptRunBody body) {
        String stage = body.stage() == null ? "" : body.stage().trim().toLowerCase(java.util.Locale.ROOT);
        return switch (stage) {
            case "setting" -> "script:setting";
            case "outline" -> "script:outline";
            case "episode" -> "script:episode:" + body.episodeNo();
            default -> null;
        };
    }

    private static String imageTarget(DramaCanvasRunDto.CanvasImageTarget t) {
        if (t == null || t.kind() == null) return null;
        return switch (t.kind().trim().toLowerCase(java.util.Locale.ROOT)) {
            case "look" -> "look:" + trim(t.id());
            case "scene" -> "scene:" + trim(t.id());
            case "material" -> "material:" + trim(t.id());
            case "segment" -> "frame:" + t.episodeNo() + ":" + trim(t.segmentId());
            default -> null;
        };
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private List<DramaCanvasRun> reloadAll(List<DramaCanvasRun> list) {
        List<DramaCanvasRun> out = new ArrayList<>();
        for (DramaCanvasRun r : list) out.add(reload(r));
        return out;
    }

    private static BusinessException notCancelable() {
        return new BusinessException(HttpStatus.CONFLICT, "DRAMA_CANVAS_RUN_NOT_CANCELABLE", "已经开始生成，停不下来了。");
    }

    static String newRunId() {
        return "dcr_" + hex12();
    }

    private static String hex12() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private String write(JsonNode n) {
        try {
            return om.writeValueAsString(n);
        } catch (Exception e) {
            throw new IllegalStateException("运行记录序列化失败", e);
        }
    }

    private static String iso(OffsetDateTime t) {
        return t == null ? null : t.toInstant().toString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

}
