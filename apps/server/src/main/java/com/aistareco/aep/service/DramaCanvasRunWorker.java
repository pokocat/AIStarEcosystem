package com.aistareco.aep.service;

import com.aistareco.aep.config.MdcTaskDecorator;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.DramaCanvasRun;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.DramaCanvasRunRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoWorker;
import com.aistareco.aep.service.storage.ImageBytes;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.RejectedExecutionException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 画布运行的后台执行（v0.198）：文字类（script / extract / storyboard）、出图（单条 / 批量）、合成；
 * 视频的状态从 {@code MaterialVideoJob} 同步（{@link #syncVideo}）；超时回收的收尾也在这里（{@link DramaCanvasRunSweeper} 调）。
 *
 * <h3>状态与钱的纪律</h3>
 * <ol>
 *   <li><b>终态只经条件更新</b>（{@link DramaCanvasRunRepository} 的 succeed / fail / cancel / expireIfUnchanged）：
 *       影响 0 行 = 别人（回收器 / 取消 / 另一次同步）先收了尾，这边放弃，<b>不结算也不退款</b>。不拿旧实体整行 save。</li>
 *   <li><b>结算 / 退款与那次状态迁移在同一个短事务</b>（{@link #txNew}，REQUIRES_NEW 的 TransactionTemplate；
 *       不用同类自调用的 {@code @Transactional}，那会被代理绕过）。事务里先改运行行、再动冻结，锁顺序固定。</li>
 *   <li><b>出图每张一个事务</b>：确认仍 running → 结果追加这张（以 (runId, 序号) 幂等）→ 记归属 → 结算。
 *       进程在两张之间挂掉，已结算的那几张已经在结果里；回收时按「部分成功」收尾、退剩余冻结。</li>
 *   <li><b>文字类</b>：模型输出通过形状校验后，「写结果 + 结算」同一事务；任何失败走「判失败 + 退款」同一事务。</li>
 *   <li>worker 里抛的异常到不了 GlobalExceptionHandler：错误码 / 原因必须写进运行记录（§8.0.1 ①）。</li>
 * </ol>
 *
 * <h3>时长上限</h3>
 * 单条运行（含批量出图的一项）从受理起超过 {@link #RUN_DEADLINE}（90 分钟）就不再调上游：已完成的保留、剩余退回。
 * 这是给 {@code CreditHoldSweeper} 留的余量 —— 它按 hold 的 <b>createdAt</b> 算，默认
 * {@code aep.credit.stale-hold-ttl-minutes=180}，不看运行是否还活着；运行必须远早于它结束，否则冻结被那边退掉后、
 * 这边再调上游就是白花厂商的钱（结算会失败、结果交付不了）。批量出图的规模上限也按这个算（见 DramaCanvasRunService）。
 *
 * <p>派发用自己的线程池（{@code aep.drama.canvas.max-concurrent}，默认 4，队列 256）；排满时在新事务里把这批判失败并退款。
 */
@Service
public class DramaCanvasRunWorker {

    private static final Logger log = LoggerFactory.getLogger(DramaCanvasRunWorker.class);

    private static final Pattern UPSTREAM_STATUS = Pattern.compile("status=(\\d{3})\\s+body=(.*)", Pattern.DOTALL);
    private static final Pattern SECRET_LIKE = Pattern.compile("(?i)(sk-|key[=:]\\s*|bearer\\s+)[A-Za-z0-9._-]{8,}");
    private static final ObjectMapper JSON = new ObjectMapper();

    static final List<String> RUNNING_ONLY = List.of(DramaCanvasRun.STATUS_RUNNING);
    static final List<String> ACTIVE = List.of(DramaCanvasRun.STATUS_QUEUED, DramaCanvasRun.STATUS_RUNNING);

    /** 单条运行从受理起最长执行多久（见类注释：必须远小于 CreditHoldSweeper 的 180 分钟 TTL）。 */
    static final Duration RUN_DEADLINE = Duration.ofMinutes(90);
    /** 画布视频运行在底层任务上等了多久算「久」（排队没开始 → 判失败退款；已交给厂商 → 只提示）。 */
    static final Duration VIDEO_STUCK_AFTER = Duration.ofMinutes(30);
    static final String SLOW_VIDEO_NOTE = "比平时久，还在生成。";

    private final DramaCanvasRunRepository runs;
    private final CreditService credits;
    private final AiModelInvocationService invocation;
    private final DramaRenderService render;
    private final DramaCanvasOwnership ownership;
    private final DramaAssembleService assembler;
    private final MaterialVideoJobRepository jobs;
    private final MaterialVideoJobService videoJobs;
    private final CdnUrlSigner signer;
    private final ObjectMapper om;
    /** 每次状态迁移 + 动钱的短事务（REQUIRES_NEW：afterCommit 回调里调也能真的开一个新事务、真的提交）。 */
    private final TransactionTemplate txNew;
    private final ThreadPoolTaskExecutor executor;

    public DramaCanvasRunWorker(DramaCanvasRunRepository runs,
                                CreditService credits,
                                AiModelInvocationService invocation,
                                DramaRenderService render,
                                DramaCanvasOwnership ownership,
                                DramaAssembleService assembler,
                                MaterialVideoJobRepository jobs,
                                MaterialVideoJobService videoJobs,
                                CdnUrlSigner signer,
                                ObjectMapper om,
                                PlatformTransactionManager txManager,
                                @Value("${aep.drama.canvas.max-concurrent:4}") int maxConcurrent) {
        this.runs = runs;
        this.credits = credits;
        this.invocation = invocation;
        this.render = render;
        this.ownership = ownership;
        this.assembler = assembler;
        this.jobs = jobs;
        this.videoJobs = videoJobs;
        this.signer = signer;
        this.om = om;
        this.txNew = new TransactionTemplate(txManager);
        this.txNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        int pool = Math.max(1, maxConcurrent);
        exec.setCorePoolSize(pool);
        exec.setMaxPoolSize(pool);
        exec.setQueueCapacity(256);
        exec.setThreadNamePrefix("drama-canvas-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        exec.setTaskDecorator(new MdcTaskDecorator());
        exec.initialize();
        this.executor = exec;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 派发
    // ═════════════════════════════════════════════════════════════════════════

    /** 每条单独派发（文字类 / 单条出图 / 合成）。必须在事务提交之后调（afterCommit）。 */
    public void dispatch(List<String> runIds) {
        for (String id : runIds) submit(() -> runBlocking(id), List.of(id), null);
    }

    /** 批量出图：整批一个任务，按顺序跑，跑完一次退回剩余冻结。 */
    public void dispatchBatch(List<String> runIds, String holdRef) {
        submit(() -> runBatch(runIds, holdRef), runIds, holdRef);
    }

    private void submit(Runnable task, List<String> ids, String sharedHoldRef) {
        try {
            executor.execute(task);
        } catch (RejectedExecutionException e) { // 含 TaskRejectedException
            // 冻结已经做了、记录已经落库，没人会再来跑它：立即判失败并退款，而不是留给十分钟后的回收
            log.warn("[drama-canvas] 运行队列已满，拒绝派发 runs={}", ids);
            abandon(ids, sharedHoldRef);
        }
    }

    /**
     * 派发失败的收尾：还在 queued 的判失败并退回冻结，<b>一个新事务里</b>做完。
     * 这里通常跑在提交事务的 afterCommit 回调里 —— 那时原事务已提交但资源还绑着，REQUIRED 会加入一个已结束的事务、
     * 写不进去；所以用 REQUIRES_NEW（{@link #txNew}）。
     */
    void abandon(List<String> ids, String sharedHoldRef) {
        try {
            txNew.executeWithoutResult(s -> {
                OffsetDateTime now = OffsetDateTime.now();
                for (String id : ids) {
                    DramaCanvasRun run = runs.findById(id).orElse(null);
                    if (run == null) continue;
                    if (runs.fail(id, List.of(DramaCanvasRun.STATUS_QUEUED), "DRAMA_CANVAS_QUEUE_FULL",
                            "生成的人太多，排不上队；积分已退回，请稍后再试。", now) != 1) continue;
                    if (sharedHoldRef == null) releaseInTx(holdRefOf(run), "画布 · 生成队列已满，退回冻结");
                }
                if (sharedHoldRef != null) releaseInTx(sharedHoldRef, "画布 · 生成队列已满，退回冻结");
            });
        } catch (RuntimeException e) {
            log.error("[drama-canvas] 队列满收尾失败（交给超时回收）runs={}", ids, e);
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 执行
    // ═════════════════════════════════════════════════════════════════════════

    /** 跑一条（同步入口，测试直接调；线程池里也是它）。 */
    public void runBlocking(String runId) {
        DramaCanvasRun run = runs.findById(runId).orElse(null);
        if (run == null) {
            log.warn("[drama-canvas] worker 找不到运行 run={}", runId);
            return;
        }
        if (!claim(run)) return;
        run = reload(run);
        try {
            switch (run.getKind()) {
                case DramaCanvasRun.KIND_SCRIPT, DramaCanvasRun.KIND_EXTRACT, DramaCanvasRun.KIND_STORYBOARD -> runText(run);
                case DramaCanvasRun.KIND_IMAGE -> runImage(run, false);
                case DramaCanvasRun.KIND_ASSEMBLE -> runAssemble(run);
                default -> failRun(run, RUNNING_ONLY, true, "DRAMA_CANVAS_RUN_KIND_UNSUPPORTED", "这种生成现在做不了。");
            }
        } catch (RuntimeException e) {
            // 兜底：漏网的异常也要让冻结回去（条件迁移，已被别人收尾就不动），并把原因写进记录
            log.warn("[drama-canvas] 运行异常 run={} kind={}", runId, run.getKind(), e);
            failRun(run, RUNNING_ONLY, !execOf(run).has("batchRunIds"), codeOf(e), friendly(e, runId));
        }
    }

    /** 批量出图：按顺序一项一项跑（每张结算），跑完把整批没用掉的冻结一次退回。 */
    public void runBatch(List<String> runIds, String holdRef) {
        try {
            for (int i = 0; i < runIds.size(); i++) {
                String id = runIds.get(i);
                // 心跳：排在后面的项也刷一下，别让超时回收把它们当成僵死
                runs.touch(runIds.subList(i, runIds.size()), OffsetDateTime.now());
                DramaCanvasRun run = runs.findById(id).orElse(null);
                if (run == null || !claim(run)) continue;
                run = reload(run);
                try {
                    runImage(run, true);
                } catch (RuntimeException e) {
                    log.warn("[drama-canvas] 批量出图单项异常 run={}", id, e);
                    failRun(run, RUNNING_ONLY, false, codeOf(e), friendly(e, id));
                }
            }
        } finally {
            release(holdRef, "画布 · 批量出图结束，退回没用掉的冻结");
        }
    }

    // ── 文字类 ─────────────────────────────────────────────────────────────────

    private void runText(DramaCanvasRun run) {
        JsonNode exec = execOf(run);
        String holdRef = exec.path("holdRef").asText(run.getId());
        long unit = Math.max(0, exec.path("unitCost").asLong(0));
        String label = exec.path("label").asText("画布 · AI 写作");
        ObjectNode meta = exec.path("meta").isObject() ? (ObjectNode) exec.path("meta") : om.createObjectNode();
        String kind = run.getKind();
        String stage = meta.path("stage").asText("");
        try {
            List<JsonNode> done = new ArrayList<>();
            JsonNode calls = exec.path("calls");
            for (int i = 0; i < calls.size(); i++) {
                if (pastDeadline(run)) {
                    throw new BusinessException(HttpStatus.GATEWAY_TIMEOUT, "DRAMA_CANVAS_RUN_DEADLINE",
                            "这次生成太久没做完，已经停下；积分已退回，请重试。");
                }
                JsonNode c = calls.get(i);
                touch(run);
                String user = c.path("user").asText("")
                        .replace(DramaCanvasPromptBuilder.CARRY, DramaCanvasPromptBuilder.carryFor(kind, meta, done));
                String content = chat(c, user);
                done.add(parseText(kind, stage, meta, i, content));
            }
            ObjectNode result = om.createObjectNode();
            switch (kind) {
                case DramaCanvasRun.KIND_SCRIPT -> {
                    if ("outline".equals(stage)) {
                        ArrayNode all = om.createArrayNode();
                        for (JsonNode chunk : done) chunk.forEach(all::add);
                        result.putObject("outline").set("episodes", all);
                    } else {
                        result.set(stage, done.get(0));
                    }
                }
                case DramaCanvasRun.KIND_EXTRACT -> result.set("extract", DramaCanvasPromptBuilder.mergeExtract(done));
                default -> result.set("storyboard", done.get(0));
            }
            String resultJson = write(result);
            // 写结果 + 结算：同一个事务。状态已被回收器 / 取消改掉 → 影响 0 行 → 不扣（冻结已由对方退回）
            Boolean settled = txNew.execute(s -> {
                if (runs.succeed(run.getId(), RUNNING_ONLY, resultJson, run.getRefsJson(), unit,
                        OffsetDateTime.now()) != 1) {
                    return false;
                }
                if (unit > 0) credits.commitHold(DramaCanvasRunService.REF_TYPE, holdRef, unit, label);
                return true;
            });
            if (Boolean.TRUE.equals(settled)) {
                log.info("[drama-canvas] 运行完成 run={} kind={} target={} cost={}", run.getId(), kind, run.getTarget(), unit);
            } else {
                log.info("[drama-canvas] 运行已被别处收尾，结果不写、不结算 run={}", run.getId());
            }
        } catch (RuntimeException e) {
            logFailure(run, e);
            failRun(run, RUNNING_ONLY, true, codeOf(e), friendly(e, run.getId()));
        }
    }

    private JsonNode parseText(String kind, String stage, ObjectNode meta, int index, String content) {
        switch (kind) {
            case DramaCanvasRun.KIND_SCRIPT -> {
                return switch (stage) {
                    case "setting" -> DramaCanvasPromptBuilder.parseSetting(content);
                    case "outline" -> {
                        JsonNode chunk = meta.path("chunks").path(index);
                        yield DramaCanvasPromptBuilder.parseOutline(content, chunk.path("fromNo").asInt(1),
                                chunk.path("toNo").asInt(1));
                    }
                    default -> DramaCanvasPromptBuilder.parseEpisode(content, meta.path("no").asInt(1),
                            meta.hasNonNull("title") ? meta.path("title").asText() : null);
                };
            }
            case DramaCanvasRun.KIND_EXTRACT -> {
                return DramaCanvasPromptBuilder.parseExtractBatch(content, meta.path("maxEpisodeNo").asInt(1));
            }
            default -> {
                return DramaCanvasPromptBuilder.parseStoryboard(content, meta.path("no").asInt(1),
                        meta.path("maxSec").asInt(10), meta.path("ids"));
            }
        }
    }

    private String chat(JsonNode call, String user) {
        List<Map<String, String>> messages = new ArrayList<>();
        String system = call.path("system").asText("");
        if (!system.isBlank()) messages.add(Map.of("role", "system", "content", system));
        messages.add(Map.of("role", "user", "content", user));
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("temperature", call.path("temperature").asDouble(0.7));
        options.put("max_tokens", call.path("maxTokens").asInt(4096));
        options.put("timeout_seconds", 180);
        if (call.path("jsonMode").asBoolean(true)) options.put("response_format", Map.of("type", "json_object"));
        try {
            AiModelInvocationService.AiModelResponse resp =
                    invocation.invokeChat(AiModelPurpose.DRAMA_SCRIPT_DRAFT, messages, options);
            return resp == null ? null : resp.content();
        } catch (BusinessException e) {
            throw e;
        } catch (RuntimeException e) {
            throw BusinessException.wrapped(HttpStatus.BAD_GATEWAY, "AI_CALL_FAILED",
                    "AI 服务暂时连不上，积分已退回，稍后再试一次。", e.toString());
        }
    }

    // ── 出图 ───────────────────────────────────────────────────────────────────

    /**
     * 逐张出图：每张「确认仍 running → 结果追加这张 → 记归属 → 结算」一个事务（{@link #persistImage}）；失败即停。
     *
     * @param shared 批量出图的一项（冻结是整批共用的，这里不退，整批跑完由 {@link #runBatch} 一次退）
     */
    private void runImage(DramaCanvasRun run, boolean shared) {
        JsonNode exec = execOf(run);
        String holdRef = exec.path("holdRef").asText(run.getId());
        long unit = Math.max(0, exec.path("unitCost").asLong(0));
        int count = Math.max(1, exec.path("count").asInt(1));
        long holdTotal = exec.path("holdTotal").asLong(unit * count);
        String label = exec.path("label").asText("画布 · 出图");
        String prompt = exec.path("prompt").asText("");
        String ratio = exec.path("ratio").asText("9:16");
        String keyPrefix = exec.path("keyPrefix").asText("drama/canvas/images/");
        String endpointId = exec.hasNonNull("endpointId") ? exec.path("endpointId").asText() : null;

        DramaRenderService.ImagePlan plan;
        try {
            plan = render.resolveImagePlan(endpointId, "出图");
        } catch (RuntimeException e) {
            // 提交之后模型被停用了：一张没出，整笔退回
            logFailure(run, e);
            failRun(run, RUNNING_ONLY, !shared, codeOf(e), friendly(e, run.getId()));
            return;
        }
        List<String> refUrls = new ArrayList<>();
        for (JsonNode k : exec.path("refKeys")) {
            String url = signer.signKey(k.asText());
            if (url != null && DramaReferenceAssembler.isFetchableImageRef(url)) refUrls.add(url);
        }

        int committed = imagesOf(reload(run)).size(); // 已持久化的（续跑时从这里接着编号）
        RuntimeException lastErr = null;
        boolean deadline = false;
        for (int i = committed; i < count; i++) {
            if (pastDeadline(run)) {
                deadline = true;
                break;
            }
            if (!stillRunning(run.getId())) break;
            touch(run);
            try {
                byte[] bytes = render.generateImageBytes(plan.endpoint(), prompt, ratio, refUrls);
                if (ImageBytes.sniff(bytes) == null) {
                    // 上游回的不是图（错误页 / 空响应）：不存、不扣，别给用户一张点不开的候选
                    throw new BusinessException(HttpStatus.BAD_GATEWAY, "IMAGE_BAD_OUTPUT", "这次没拿到能用的图片，再试一次。");
                }
                DramaRenderService.StoredImage stored = render.storeImageBytes(bytes, keyPrefix,
                        "图生成了但没保存下来，再试一次。");
                if (!persistImage(run, i, stored, unit, holdRef, label)) break; // 已被回收 / 取消：这张不算、不扣
                committed = i + 1;
            } catch (RuntimeException e) {
                lastErr = e;
                logFailure(run, e);
                break;
            }
        }
        finishImage(run, shared, unit, count, holdTotal, holdRef, lastErr, deadline);
    }

    /**
     * 一张图的「追加结果 + 记归属 + 结算」，一个事务：运行不在 running（被回收 / 取消）→ 放弃、不扣；
     * 结果里已经有第 index 张（重复调用）→ 当作已完成，不重复扣；结算抛错 → 整个事务回滚（结果里也没有这张）。
     *
     * @return 这张是否已经在结果里且结算过
     */
    private boolean persistImage(DramaCanvasRun run, int index, DramaRenderService.StoredImage stored, long unit,
                                 String holdRef, String label) {
        Boolean ok = txNew.execute(s -> {
            DramaCanvasRun fresh = runs.findById(run.getId()).orElse(null);
            if (fresh == null || !DramaCanvasRun.STATUS_RUNNING.equals(fresh.getStatus())) return false;
            ObjectNode result = resultObject(fresh);
            ArrayNode images = result.withArray("images");
            if (images.size() > index) return true;
            images.addObject().put("key", stored.key()).put("runId", run.getId());
            // 先改运行行（锁住它，回收器的条件更新就进不来），再动冻结
            if (runs.progress(run.getId(), write(result), OffsetDateTime.now()) != 1) {
                s.setRollbackOnly();
                return false;
            }
            ownership.record(run.getOwnerUserId(), stored.key(), stored.bytes(), stored.contentType());
            if (unit > 0) {
                credits.commitHold(DramaCanvasRunService.REF_TYPE, holdRef, unit, label + " · 第 " + (index + 1) + " 张");
            }
            return true;
        });
        return Boolean.TRUE.equals(ok);
    }

    /** 出图收尾（一个事务）：有结算过的图 → succeeded（部分也算）、退剩余；一张没有 → failed、整笔退。已被收尾就不动。 */
    private void finishImage(DramaCanvasRun run, boolean shared, long unit, int count, long holdTotal, String holdRef,
                             RuntimeException lastErr, boolean deadline) {
        txNew.executeWithoutResult(s -> {
            DramaCanvasRun fresh = runs.findById(run.getId()).orElse(null);
            if (fresh == null || !DramaCanvasRun.STATUS_RUNNING.equals(fresh.getStatus())) return;
            ObjectNode result = resultObject(fresh);
            int committed = result.withArray("images").size();
            OffsetDateTime now = OffsetDateTime.now();
            if (committed == 0) {
                String code = deadline ? "DRAMA_CANVAS_RUN_DEADLINE"
                        : lastErr == null ? "DRAMA_CANVAS_RUN_FAILED" : codeOf(lastErr);
                String msg = deadline ? "这次出图太久没做完，已经停下；积分已退回，请重试。"
                        : lastErr == null ? "图没出来，积分已退回。" : friendly(lastErr, run.getId());
                if (runs.fail(run.getId(), RUNNING_ONLY, code, truncate(msg, 500), now) == 1 && !shared) {
                    releaseInTx(holdRef, "画布 · 出图没做成，退回冻结");
                }
                return;
            }
            List<String> extra = new ArrayList<>();
            if (committed < count) {
                String why = deadline ? "太久没做完，已经停下"
                        : lastErr == null ? "中途停了" : friendly(lastErr, run.getId());
                extra.add("出了 " + committed + " 张，另外 " + (count - committed) + " 张没出来（" + why + "），没出来的积分已退回。");
            }
            long spent = unit * committed;
            if (runs.succeed(run.getId(), RUNNING_ONLY, write(result), appendNotes(fresh.getRefsJson(), extra), spent, now) == 1
                    && !shared && spent < holdTotal) {
                releaseInTx(holdRef, "画布 · 没出来的退回");
            }
        });
    }

    // ── 合成 ───────────────────────────────────────────────────────────────────

    private void runAssemble(DramaCanvasRun run) {
        JsonNode exec = execOf(run);
        int no = exec.path("episodeNo").asInt(1);
        List<String> keys = new ArrayList<>();
        exec.path("videoKeys").forEach(k -> keys.add(k.asText()));
        try {
            touch(run);
            DramaAssembleService.AssembledVideo a = assembler.assembleKeys(run.getOwnerUserId(), run.getCanvasId(), no, keys);
            ObjectNode result = om.createObjectNode();
            ObjectNode as = result.putObject("assembled");
            as.put("key", a.key());
            as.put("durationSec", a.durationSec());
            as.put("at", OffsetDateTime.now().toInstant().toString());
            ArrayNode vk = as.putArray("videoKeys");
            keys.forEach(vk::add);
            as.put("runId", run.getId());
            txNew.executeWithoutResult(s -> {
                // 成片的归属必须记上（读画布时只给本人的 key 签地址）；已记过则是空操作
                ownership.record(run.getOwnerUserId(), a.key(), a.bytes(), "video/mp4");
                runs.succeed(run.getId(), RUNNING_ONLY, write(result), run.getRefsJson(), 0, OffsetDateTime.now());
            });
        } catch (RuntimeException e) {
            logFailure(run, e);
            failRun(run, RUNNING_ONLY, false, codeOf(e), friendly(e, run.getId()));
        }
    }

    // ── 视频：按 MaterialVideoJob 同步 ─────────────────────────────────────────

    /**
     * 按视频任务同步一次运行状态（GET runs / 取消 / 超时回收都调它）。任务是真值：
     * queued → queued；submitting / generating → running；succeeded → 取视频 key（记归属）+ 末帧 key（记归属）；
     * failed → failed（冻结已由视频 worker 退回）。<b>已判失败的运行也会再核对一次</b>：管理端对账把底层任务恢复成功后，
     * 这里把运行改回成功（只从 failed 改、只读原任务，绝不重新提交）。所有迁移都是条件更新。
     * 同步本身出错只记日志、原样返回，不影响读。
     */
    public DramaCanvasRun syncVideo(DramaCanvasRun run) {
        if (run == null || !DramaCanvasRun.KIND_VIDEO.equals(run.getKind())) return run;
        boolean recovering = DramaCanvasRun.STATUS_FAILED.equals(run.getStatus());
        if (run.isTerminal() && !recovering) return run;
        try {
            MaterialVideoJob job = run.getJobId() == null ? null : jobs.findById(run.getJobId()).orElse(null);
            if (recovering) {
                if (job != null && "succeeded".equals(job.getStatus())) {
                    finishVideo(run, job, List.of(DramaCanvasRun.STATUS_FAILED));
                }
                return reload(run);
            }
            if (job == null) {
                failRun(run, ACTIVE, false, "DRAMA_CANVAS_VIDEO_JOB_MISSING", "视频任务找不到了，请重新生成。");
                return reload(run);
            }
            String st = job.getStatus() == null ? "queued" : job.getStatus();
            switch (st) {
                case "queued" -> {
                    return run;
                }
                case "succeeded" -> {
                    finishVideo(run, job, ACTIVE);
                    return reload(run);
                }
                case "failed" -> {
                    String jm = job.getErrorMessage();
                    if (MaterialVideoJobService.CANCELED_MESSAGE.equals(jm)) {
                        runs.cancel(run.getId(), ACTIVE, "已取消", OffsetDateTime.now());
                    } else if (jm != null && jm.startsWith(MaterialVideoWorker.MIRROR_FAILED_CODE)) {
                        // 画布视频提交时带了 require_mirror：没存进我方存储 → 视频 worker 已判失败并退回冻结
                        failRun(run, ACTIVE, false, MaterialVideoWorker.MIRROR_FAILED_CODE,
                                "视频生成好了但没存下来，积分已退回，请重试。");
                    } else {
                        failRun(run, ACTIVE, false, "VIDEO_GENERATION_FAILED", videoFailMessage(jm));
                    }
                    return reload(run);
                }
                default -> {
                    if (DramaCanvasRun.STATUS_QUEUED.equals(run.getStatus())) {
                        runs.transition(run.getId(), DramaCanvasRun.STATUS_QUEUED, DramaCanvasRun.STATUS_RUNNING,
                                OffsetDateTime.now());
                        return reload(run);
                    }
                    return run;
                }
            }
        } catch (RuntimeException e) {
            log.warn("[drama-canvas] 视频状态同步失败 run={} job={}: {}", run.getId(), run.getJobId(), e.toString());
            return run;
        }
    }

    /** 回收器调：把「画布已判失败、底层任务后来被对账恢复成功」的视频运行改回成功。返回改回了几条。 */
    int recoverVideos(int limit) {
        int n = 0;
        for (DramaCanvasRun r : runs.findRecoverableVideoRuns(PageRequest.of(0, Math.max(1, limit)))) {
            if (DramaCanvasRun.STATUS_SUCCEEDED.equals(syncVideo(r).getStatus())) n++;
        }
        return n;
    }

    /** 视频成片有平台 key、但登记到用户名下时出错（可重试：GET runs 与回收器的对账恢复都会再捡起来）。 */
    static final String VIDEO_RECORD_FAILED = "DRAMA_CANVAS_VIDEO_RECORD_FAILED";
    /** 视频成片确实没有平台 key（没带 require_mirror 的旧任务，只有厂商临时地址）：永远交付不了。 */
    static final String VIDEO_NOT_STORED = "DRAMA_CANVAS_VIDEO_NOT_STORED";

    /**
     * 视频成功收尾：一个事务里<b>先</b>条件更新运行状态（从 {@code from} 改成 succeeded），<b>只有赢家</b>接着登记
     * 视频 key 与末帧 key 的归属 —— GET runs 与回收器同时同步同一条时，输家的条件更新影响 0 行、什么都不登记
     * （{@code ownership.record} 是先查再插，两边都查不到就会各插一行）。登记抛错 → 整个事务回滚（状态也没改），
     * 标成可重试的 {@link #VIDEO_RECORD_FAILED}，对账恢复会再来一次。
     */
    private void finishVideo(DramaCanvasRun run, MaterialVideoJob job, List<String> from) {
        boolean recovering = from.contains(DramaCanvasRun.STATUS_FAILED);
        String key = videoKeyOf(job.getVideoUrl());
        if (key == null) {
            // 没带 require_mirror 的旧任务才会走到这里：视频链路没能把成片存进我方存储（只有厂商临时地址）。
            // 画布只存 key，交付不了；那条链此时已经按成功结算了，如实说明，别拿会过期的外链冒充。
            log.warn("[drama-canvas] 视频成片没有我方存储 key run={} job={} url={}", run.getId(), job.getId(),
                    truncate(job.getVideoUrl(), 160));
            if (!recovering) {
                failRun(run, from, false, VIDEO_NOT_STORED,
                        "视频生成好了，但没能存进平台（追查号 " + run.getId() + "），请联系客服处理这次的积分。");
            }
            return;
        }
        String owner = run.getOwnerUserId();
        String lastFrameKey = job.getLastFrameCdnKey() == null || job.getLastFrameCdnKey().isBlank()
                ? null : job.getLastFrameCdnKey();
        ObjectNode result = om.createObjectNode();
        ObjectNode v = result.putObject("video");
        v.put("key", key);
        if (lastFrameKey != null) v.put("lastFrameKey", lastFrameKey);
        v.put("durationSec", job.getDurationSec());
        v.put("runId", run.getId());
        OffsetDateTime at = job.getCompletedAt() != null ? job.getCompletedAt() : OffsetDateTime.now();
        v.put("createdAt", at.toInstant().toString());
        long cost = job.getCreditsHeld() > 0 ? job.getCreditsHeld() : run.getCost();
        try {
            Boolean won = txNew.execute(s -> {
                if (runs.succeed(run.getId(), from, write(result), run.getRefsJson(), cost, OffsetDateTime.now()) != 1) {
                    return false; // 输家：别处已经收了尾，不登记
                }
                // 视频 worker 镜像成功时已经按 app=drama 记过视频这一行（这里是空操作）；没记上的话这里补上
                ownership.record(owner, key, 0, "video/mp4");
                if (lastFrameKey != null) ownership.record(owner, lastFrameKey, 0, "image/png");
                return true;
            });
            if (Boolean.TRUE.equals(won) && recovering) {
                log.info("[drama-canvas] 视频对账恢复后改回成功 run={} job={}", run.getId(), job.getId());
            }
        } catch (RuntimeException e) {
            log.warn("[drama-canvas] 视频归属登记失败（可重试）run={} key={}: {}", run.getId(), key, e.toString());
            if (!recovering) {
                failRun(run, from, false, VIDEO_RECORD_FAILED,
                        "视频生成好了，登记到你名下时出了点问题，系统会自动重试，不用重新生成。");
            }
        }
    }

    /**
     * 视频任务存的 videoUrl → 我方存储 key：OSS 走 signer 反解；本地假 CDN（/cdn/&lt;key&gt;）按公开前缀剥。
     * 厂商外链 → null。
     */
    String videoKeyOf(String url) {
        if (url == null || url.isBlank()) return null;
        String k = signer.keyOf(url);
        if (k != null && !k.isBlank()) return k;
        String probe = signer.publicUrlFor("__k__");
        if (probe != null && probe.endsWith("__k__")) {
            String base = probe.substring(0, probe.length() - "__k__".length());
            if (!base.isEmpty() && url.startsWith(base)) {
                String rest = url.substring(base.length());
                int q = rest.indexOf('?');
                if (q >= 0) rest = rest.substring(0, q);
                return rest.isBlank() ? null : rest;
            }
        }
        return null;
    }

    private static String videoFailMessage(String raw) {
        if (raw == null || raw.isBlank()) return "视频没生成出来，积分已退回。";
        String s = raw.replaceAll("[，,]\\s*taskId=[^）)，,]*", "").strip();
        return "视频没生成出来（" + truncate(s, 200) + "），积分已退回。";
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 超时回收（DramaCanvasRunSweeper 调）
    // ═════════════════════════════════════════════════════════════════════════

    /**
     * 把一条僵死的在途记录收尾（一个事务）：只在「仍在途、且 updatedAt 还是 {@code run} 里读到的值」时生效
     * （读到之后 worker 动过 = 它还活着 → 影响 0 行、放弃、不退款）。已经有结算过的图 → 部分成功、退剩余；
     * 否则 → 超时失败、退整笔（批量出图的共用冻结由 {@link #expireBatch} 统一退）。
     *
     * @return 是否收了尾
     */
    boolean expireStale(DramaCanvasRun run, boolean releaseOwnHold) {
        try {
            Boolean ok = txNew.execute(s -> expireOne(run, releaseOwnHold));
            return Boolean.TRUE.equals(ok);
        } catch (RuntimeException e) {
            log.warn("[drama-canvas] 超时收尾失败 run={}: {}", run.getId(), e.toString());
            return false;
        }
    }

    /**
     * 批量出图整批都僵了才回收（一个事务）：每项按 {@link #expireOne} 收尾，共用冻结最后退一次；
     * 任何一项在读到之后动过（条件更新影响 0 行）→ 整批回滚、这一轮不动。
     *
     * @return 收尾了几项
     */
    int expireBatch(List<DramaCanvasRun> members, String holdRef) {
        try {
            Integer n = txNew.execute(s -> {
                int count = 0;
                for (DramaCanvasRun m : members) {
                    if (m.isTerminal()) continue;
                    if (!expireOne(m, false)) {
                        s.setRollbackOnly();
                        return 0;
                    }
                    count++;
                }
                if (holdRef != null && !holdRef.isBlank()) releaseInTx(holdRef, "画布 · 批量出图超时，退回没用掉的冻结");
                return count;
            });
            return n == null ? 0 : n;
        } catch (RuntimeException e) {
            log.warn("[drama-canvas] 批量超时收尾失败 ref={}: {}", holdRef, e.toString());
            return 0;
        }
    }

    private boolean expireOne(DramaCanvasRun run, boolean releaseOwnHold) {
        OffsetDateTime now = OffsetDateTime.now();
        JsonNode exec = execOf(run);
        long unit = Math.max(0, exec.path("unitCost").asLong(0));
        int images = DramaCanvasRun.KIND_IMAGE.equals(run.getKind()) ? imagesOf(run).size() : 0;
        int rows;
        if (images > 0) {
            int count = Math.max(1, exec.path("count").asInt(1));
            String refs = appendNotes(run.getRefsJson(),
                    List.of("只出了 " + images + " 张，另外 " + (count - images) + " 张没出来，剩下的积分已退回。"));
            rows = runs.expireIfUnchanged(run.getId(), run.getUpdatedAt(), DramaCanvasRun.STATUS_SUCCEEDED,
                    unit * images, refs, null, null, now);
        } else {
            rows = runs.expireIfUnchanged(run.getId(), run.getUpdatedAt(), DramaCanvasRun.STATUS_FAILED, run.getCost(),
                    run.getRefsJson(), "DRAMA_CANVAS_RUN_TIMEOUT", "生成超时，没有产出结果；积分已退回，请重试。", now);
        }
        if (rows != 1) return false;
        if (releaseOwnHold) releaseInTx(holdRefOf(run), "画布 · 生成超时，退回冻结");
        log.warn("[drama-canvas] 运行超时收尾 run={} kind={} target={} images={}", run.getId(), run.getKind(),
                run.getTarget(), images);
        return true;
    }

    /**
     * 回收一条视频运行（超时回收调）：先按任务同步；还没终态且底层任务已经等了 {@link #VIDEO_STUCK_AFTER}：
     * <ul>
     *   <li>任务还在 queued、<b>没有</b> externalTaskId（从没交给厂商，典型是进程重启丢了派发队列）→ 同一事务里
     *       条件更新判任务失败并退回冻结（与 worker 认领互斥，赢了才算）+ 运行记录失败；</li>
     *   <li>已经交给厂商（有 externalTaskId）或已被认领在提交中 → <b>不动</b>（只能走管理端对账，AGENTS.md 视频段）；
     *       运行保持 running、errorMessage 留空，refs.notes 里加一句「比平时久，还在生成」。</li>
     * </ul>
     *
     * @return 是否判了失败
     */
    boolean reapVideo(DramaCanvasRun run, OffsetDateTime now) {
        DramaCanvasRun synced = syncVideo(run);
        if (synced == null || synced.isTerminal() || synced.getJobId() == null) return false;
        MaterialVideoJob job = jobs.findById(synced.getJobId()).orElse(null);
        if (job == null) return false;
        OffsetDateTime since = job.getCreatedAt() != null ? job.getCreatedAt() : synced.getCreatedAt();
        if (since == null || since.isAfter(now.minus(VIDEO_STUCK_AFTER))) return false;
        boolean submitted = job.getExternalTaskId() != null && !job.getExternalTaskId().isBlank();
        if ("queued".equals(job.getStatus()) && !submitted) {
            Boolean expired = txNew.execute(s -> {
                if (!videoJobs.expireQueued(job.getId(), synced.getOwnerUserId(), "排队太久一直没开始，已退回积分")) {
                    return false; // worker 刚好接手了：以任务为准，下次同步再看
                }
                if (runs.fail(synced.getId(), ACTIVE, "DRAMA_CANVAS_VIDEO_QUEUE_TIMEOUT",
                        "视频排了太久一直没开始，积分已退回，请重试。", OffsetDateTime.now()) != 1) {
                    s.setRollbackOnly(); // 运行已被别处收尾：任务那边也别动
                    return false;
                }
                return true;
            });
            if (Boolean.TRUE.equals(expired)) {
                log.warn("[drama-canvas] 视频排队超时判失败 run={} job={}", synced.getId(), job.getId());
                return true;
            }
            return false;
        }
        String refs = synced.getRefsJson();
        if (refs == null || !refs.contains(SLOW_VIDEO_NOTE)) {
            runs.setRefsIfActive(synced.getId(), appendNotes(refs, List.of(SLOW_VIDEO_NOTE)));
            log.info("[drama-canvas] 视频比平时久 run={} job={} status={} submitted={}", synced.getId(), job.getId(),
                    job.getStatus(), submitted);
        }
        return false;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 状态写入
    // ═════════════════════════════════════════════════════════════════════════

    private boolean claim(DramaCanvasRun run) {
        return runs.transition(run.getId(), DramaCanvasRun.STATUS_QUEUED, DramaCanvasRun.STATUS_RUNNING,
                OffsetDateTime.now()) == 1;
    }

    private void touch(DramaCanvasRun run) {
        runs.touch(List.of(run.getId()), OffsetDateTime.now());
    }

    private boolean stillRunning(String runId) {
        return runs.findById(runId).map(r -> DramaCanvasRun.STATUS_RUNNING.equals(r.getStatus())).orElse(false);
    }

    /** 从受理起超过 {@link #RUN_DEADLINE} 了没有（受理时间 ≈ hold 的 createdAt，CreditHoldSweeper 就按它算）。 */
    private boolean pastDeadline(DramaCanvasRun run) {
        return run.getCreatedAt() != null && OffsetDateTime.now().isAfter(run.getCreatedAt().plus(RUN_DEADLINE));
    }

    /**
     * 判失败（条件：状态在 {@code from} 里）+ 退冻结，同一个事务；已被别人收尾 → 什么都不做。
     * 失败时 cost / 结果不动（契约：失败后仍显示冻结时的原值）。
     */
    private void failRun(DramaCanvasRun run, List<String> from, boolean releaseOwnHold, String code, String message) {
        try {
            txNew.executeWithoutResult(s -> {
                if (runs.fail(run.getId(), from, code, truncate(message, 500), OffsetDateTime.now()) != 1) return;
                if (releaseOwnHold) releaseInTx(holdRefOf(run), "画布 · 没做成，退回冻结");
                log.warn("[drama-canvas] 运行失败 run={} kind={} code={} msg={}", run.getId(), run.getKind(), code, message);
            });
        } catch (RuntimeException e) {
            // 退款抛错会让整个事务回滚（状态也没改）：留给超时回收重试，别吞成「已退回」
            log.error("[drama-canvas] 失败收尾没写进去（交给超时回收）run={} code={}", run.getId(), code, e);
        }
    }

    /** 事务里的退款：抛错就让整个事务（含状态迁移）一起回滚，不假装退过。已结算完 / 已退回 = 空操作。 */
    private void releaseInTx(String holdRef, String reason) {
        if (holdRef == null || holdRef.isBlank()) return;
        credits.releaseHold(DramaCanvasRunService.REF_TYPE, holdRef, reason);
    }

    /** 不带状态迁移的 best-effort 退回（批量出图结束时退共用冻结的剩余）。已结算完 / 已退回 = 空操作。 */
    public void release(String holdRef, String reason) {
        if (holdRef == null || holdRef.isBlank()) return;
        try {
            credits.releaseHold(DramaCanvasRunService.REF_TYPE, holdRef, reason);
        } catch (Exception e) {
            log.warn("[drama-canvas] 退回冻结失败 ref={}: {}", holdRef, e.getMessage());
        }
    }

    private String appendNotes(String refsJson, List<String> extra) {
        if (extra == null || extra.isEmpty()) return refsJson;
        ObjectNode refs;
        try {
            JsonNode n = refsJson == null ? null : om.readTree(refsJson);
            refs = n != null && n.isObject() ? (ObjectNode) n : om.createObjectNode();
        } catch (Exception e) {
            refs = om.createObjectNode();
        }
        if (!refs.has("requested")) refs.put("requested", 0);
        if (!refs.has("applied")) refs.put("applied", 0);
        ArrayNode notes = refs.path("notes").isArray() ? (ArrayNode) refs.get("notes") : refs.putArray("notes");
        extra.forEach(notes::add);
        return write(refs);
    }

    private ObjectNode resultObject(DramaCanvasRun run) {
        try {
            JsonNode n = run.getResultJson() == null ? null : om.readTree(run.getResultJson());
            return n != null && n.isObject() ? (ObjectNode) n : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private ArrayNode imagesOf(DramaCanvasRun run) {
        return resultObject(run).withArray("images");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 错误 → 用户看得懂的话（§8.0.1 ①）
    // ═════════════════════════════════════════════════════════════════════════

    private void logFailure(DramaCanvasRun run, RuntimeException e) {
        String detail = e instanceof BusinessException be ? be.getInternalDetail() : null;
        log.warn("[drama-canvas] 生成失败 run={} kind={} target={} code={} msg={} detail={}",
                run.getId(), run.getKind(), run.getTarget(), codeOf(e), e.getMessage(), truncate(detail, 600));
    }

    static String codeOf(Throwable e) {
        if (e instanceof BusinessException be && be.getCode() != null) return be.getCode();
        if (e instanceof ResponseStatusException) return "DRAMA_CANVAS_CREDIT_SETTLE_FAILED";
        return "DRAMA_CANVAS_RUN_FAILED";
    }

    /**
     * 给用户看的失败原因：上游 4xx 把它的原话（截断、脱敏）说出来 —— 那是「我们请求哪儿不对」，用户据此改；
     * 5xx / 网络问题笼统说（细节在日志）；我们自己写过文案的直出；其余给异常类型 + 追查号。
     */
    static String friendly(Throwable e, String runId) {
        if (e instanceof BusinessException be) {
            String up = upstreamRejection(be.getInternalDetail());
            if (up != null) return up;
            if (be.getMessage() != null && !be.getMessage().isBlank()) return be.getMessage();
        }
        if (e instanceof ResponseStatusException) {
            return "积分结算没成功，这次没扣费；再试一次（追查号 " + runId + "）。";
        }
        return "生成失败（" + (e == null ? "未知原因" : e.getClass().getSimpleName()) + "）· 追查号 " + runId;
    }

    /** internalDetail 里带着上游 4xx 的状态码与响应体时，抽出给用户看的那句；5xx / 没有 → null。 */
    static String upstreamRejection(String internalDetail) {
        if (internalDetail == null) return null;
        Matcher m = UPSTREAM_STATUS.matcher(internalDetail);
        if (!m.find()) return null;
        int status = Integer.parseInt(m.group(1));
        if (status < 400 || status >= 500) return null;
        String body = m.group(2).strip();
        String msg = null;
        try {
            JsonNode root = JSON.readTree(body.endsWith("…") ? body.substring(0, body.length() - 1) : body);
            for (JsonNode cand : new JsonNode[]{root.path("error").path("message"), root.path("message"), root.path("error")}) {
                if (cand.isTextual() && !cand.asText().isBlank()) {
                    msg = cand.asText().strip();
                    break;
                }
            }
        } catch (Exception ignore) {
            // 响应体不是 JSON（网关的 HTML 错误页）或被截断：不外泄，给笼统的
        }
        if (msg == null) return "模型拒绝了这次请求（上游 " + status + "），积分已退回。";
        msg = SECRET_LIKE.matcher(msg).replaceAll("$1***");
        return "模型拒绝了这次请求：" + truncate(msg, 200) + "（积分已退回）";
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 小工具
    // ═════════════════════════════════════════════════════════════════════════

    /** 运行记录的 input_json._exec（缺失返回空对象）。 */
    public JsonNode execOf(DramaCanvasRun run) {
        try {
            JsonNode n = run.getInputJson() == null ? null : om.readTree(run.getInputJson());
            JsonNode exec = n == null ? null : n.get("_exec");
            return exec != null && exec.isObject() ? exec : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    String holdRefOf(DramaCanvasRun run) {
        return execOf(run).path("holdRef").asText(run.getId());
    }

    private DramaCanvasRun reload(DramaCanvasRun run) {
        return runs.findById(run.getId()).orElse(run);
    }

    private String write(JsonNode n) {
        try {
            return om.writeValueAsString(n);
        } catch (Exception e) {
            throw new IllegalStateException("运行结果序列化失败", e);
        }
    }

    private static String truncate(String s, int n) {
        if (s == null) return null;
        return s.length() > n ? s.substring(0, n) + "…" : s;
    }
}
