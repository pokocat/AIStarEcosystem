package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapAccountService;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.config.IpStudioProperties;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPricingDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpStylePresetDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpRunNodeRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 节点运行：输入编译 → preflight → 冻结积分 → 派发异步 worker。
 *
 * <p>顺序是硬约束（AGENTS.md §8.0）：**preflight 一定在 hold 之前**。引擎未绑定 / 提示词未配置
 * 时抛 503 且不冻结一分钱，绝不用占位图冒充产物。
 *
 * <p>计费范式抄 {@code DramaReferenceAssetService.generateReferenceSheet}：整批一次 hold，
 * 每张成功先 {@code commitHold} 再落产物 —— 反过来会出现「commitHold 失败（内部含释放）
 * 但图已入库」，用户白得一张图、账本上却退了款。
 */
@Service
public class IpRunService {

    private static final Logger log = LoggerFactory.getLogger(IpRunService.class);

    /** CreditHold referenceType；referenceId = runId（一次运行一个 hold）。 */
    public static final String REF_TYPE = "ip-run";

    /** 沿入边向上找 identity / style / source 的最大跳数（模板里它们挂在 master 上，不在每个 look 上）。 */
    private static final int ANCESTOR_DEPTH = 8;

    private static final List<String> ALLOWED_SIZES = List.of("768x1024", "1024x1024", "768x1365");
    private static final String DEFAULT_SIZE = "768x1024";

    private final IpRunRepository runRepo;
    private final IpProjectService projects;
    private final IpCatalogService catalog;
    private final IpStudioProperties props;
    private final PromptService prompts;
    private final DapMultimodalClient multimodal;
    private final DapPricingService pricing;
    private final DapAccountService accounts;
    private final CreditService credits;
    private final IpRunWorker worker;
    private final com.aistareco.aep.service.materialvideo.MaterialVideoJobService videoJobs;
    private final ObjectMapper om;

    public IpRunService(IpRunRepository runRepo,
                        IpProjectService projects,
                        IpCatalogService catalog,
                        IpStudioProperties props,
                        PromptService prompts,
                        DapMultimodalClient multimodal,
                        DapPricingService pricing,
                        DapAccountService accounts,
                        CreditService credits,
                        IpRunWorker worker,
                        ObjectMapper om,
                         com.aistareco.aep.service.materialvideo.MaterialVideoJobService videoJobs) {
        this.runRepo = runRepo;
        this.projects = projects;
        this.catalog = catalog;
        this.props = props;
        this.prompts = prompts;
        this.multimodal = multimodal;
        this.pricing = pricing;
        this.accounts = accounts;
        this.credits = credits;
        this.worker = worker;
        this.videoJobs = videoJobs;
        this.om = om;
    }

    // ── 单价 ──────────────────────────────────────────────────

    public IpPricingDto pricingDto() {
        return new IpPricingDto(pricing.ipIdentity(), pricing.ipImage());
    }

    // ── 运行 ──────────────────────────────────────────────────

    /**
     * 运行一个 identity / generate 节点。
     *
     * @param req 可选携带最新 doc（运行前顺手保存，避免防抖 PUT 还没落地就点了运行）
     */
    @Transactional
    public IpRunDto run(String userId, String projectId, String nodeId, IpRunNodeRequest req) {
        IpProject project = projects.required(userId, projectId);
        if (req != null && req.doc() != null && !req.doc().isNull()) {
            projects.applyUpdate(project, new com.aistareco.aep.ipstudio.dto.IpStudioRequests
                    .IpUpdateProjectRequest(null, req.doc()));
            projects.save(project);
        }
        JsonNode doc = projects.readDoc(project);

        JsonNode node = IpDocs.node(doc, nodeId);
        if (node == null) {
            throw BusinessException.notFound("IP_NODE_NOT_FOUND", "画布上找不到该节点，请刷新后重试");
        }
        String type = IpDocs.typeOf(node);
        // 能跑的只有图节点 —— 文字 / 分组这些不产出媒体，跑它们没有意义。
        // 视频节点走另一条链（要有形象才能跑），不在这里。
        if (!IpDocs.T_IMAGE.equals(type)) {
            throw BusinessException.badRequest("IP_NODE_NOT_RUNNABLE", "这个节点不用运行");
        }
        if (!runRepo.findByProjectIdAndNodeIdAndStatus(projectId, nodeId, IpRun.STATUS_RUNNING).isEmpty()) {
            throw new BusinessException(HttpStatus.CONFLICT, "IP_RUN_ALREADY_RUNNING",
                    "该节点正在生成中，请等它完成后再运行");
        }

        // 输入编译（含缺失校验 + 资产 key 归属闸）—— 全部在 hold 之前
        Compiled compiled = compileGeneration(userId, projectId, doc, node);
        return execute(userId, project, projectId, nodeId, compiled);
    }

    /**
     * 显式生成 —— 画布直接说清「用这段提示词、拿这几张图当参考、出几张」。
     *
     * <p>为什么不都走上面那条按节点编译的路：<b>该拿哪几张图当参考是画布的判断</b>。
     * 用户框选了两张、或者在蒙版编辑里只针对当前这一张，服务端从文档里回溯上游是猜不出来的。
     * 服务端保留的仍然是它该管的部分 —— key 归属闸、提示词模板、模型白名单、计价、
     * 冻结与结算、派发。只是「参考谁」这件事由画布说了算。
     */
    @Transactional
    public IpRunDto generate(String userId, String projectId, IpGenerateRequest req) {
        IpProject project = projects.required(userId, projectId);
        if (req == null || req.prompt() == null || req.prompt().isBlank()) {
            requireNoMissing(List.of("prompt"));
        }
        String nodeId = req.nodeId() == null || req.nodeId().isBlank() ? "adhoc" : req.nodeId();
        if (!"adhoc".equals(nodeId)
                && !runRepo.findByProjectIdAndNodeIdAndStatus(projectId, nodeId, IpRun.STATUS_RUNNING).isEmpty()) {
            throw new BusinessException(HttpStatus.CONFLICT, "IP_RUN_ALREADY_RUNNING",
                    "这张正在生成中，等它完成再跑");
        }
        Compiled compiled = compileExplicit(userId, req);
        return execute(userId, project, projectId, nodeId, compiled);
    }

    /** 画布出视频的请求。 */
    public record IpVideoRequest(String prompt, String refKey, Integer durationSec,
                                 String aspectRatio, String model) {}

    /**
     * 画布出视频。
     *
     * <p>走的是通用视频链（{@code MaterialVideoJobService}，分区 {@code ipstudio}），
     * **不是** dap 的数字人衍生视频 —— 那条要求先有 {@code avatarId}，也就是必须发布之后，
     * 而画布上人往往还没发布就想让一张图动起来。
     *
     * <p>计费、时长校验、端点白名单、未配置即失败快，全部由 {@code MaterialVideoJobService}
     * 承担（它已经把这套走了两条业务线）；这里只负责把画布的说法翻译过去，并守住 key 归属闸。
     */
    @Transactional
    public JsonNode generateVideo(String userId, String projectId, IpVideoRequest req) {
        projects.required(userId, projectId);
        if (req == null || req.prompt() == null || req.prompt().isBlank()) {
            requireNoMissing(List.of("prompt"));
        }
        // 首帧图：非本人的 key 直接 400（画布是客户端，能塞任何字符串进来）
        String refKey = projects.requireOwnedAssetKey(userId, req.refKey());

        ObjectNode item = om.createObjectNode();
        item.put("name", "画布视频");
        item.put("kind", "ipstudio-clip");
        item.put("prompt", req.prompt().trim());
        if (req.durationSec() != null) item.put("duration_sec", req.durationSec());
        if (req.aspectRatio() != null && !req.aspectRatio().isBlank()) item.put("aspect_ratio", req.aspectRatio());
        if (req.model() != null && !req.model().isBlank()) item.put("endpoint_id", req.model().trim());
        if (refKey != null) item.putObject("variant_config").put("first_frame_key", refKey);

        ObjectNode body = om.createObjectNode();
        body.putArray("items").add(item);

        List<JsonNode> created = videoJobs.submit(body, userId,
                com.aistareco.aep.service.materialvideo.MaterialVideoJobService.APP_IPSTUDIO);
        if (created.isEmpty()) {
            throw BusinessException.badRequest("IP_VIDEO_SUBMIT_FAILED", "视频任务没建起来，请稍后再试");
        }
        return created.get(0);
    }

    /** 冻结 → 落库 → 派发。两条入口共用，计费纪律只有这一处。 */
    private IpRunDto execute(String userId, IpProject project, String projectId, String nodeId, Compiled compiled) {

        // preflight（§8.0）：引擎与提示词，缺一不可，且不冻结
        preflight(compiled);

        accounts.ensureMonthlyGrant(userId);

        String runId = uniqueRunId();
        long total = compiled.unitCost() * compiled.count();
        if (total > 0) {
            // 余额不足在这里抛 402，run 行不落库
            credits.hold(userId, total, REF_TYPE, runId, compiled.holdLabel());
        }
        // 把「按什么价冻的」写进 _exec：worker 结算时只认这份快照，绝不回头再读一次后台单价。
        // 否则运营在 hold 与 commit 之间改了价，worker 会按新价 commit —— 少扣（用户白得图）
        // 或多扣（超过 hold 剩余，commitHold 直接 400）都是真金白银的错账。
        ObjectNode execSnapshot = (ObjectNode) compiled.inputs().path("_exec");
        execSnapshot.put("unitCost", compiled.unitCost());
        execSnapshot.put("holdTotal", total);

        IpRun run = IpRun.builder()
                .id(runId)
                .projectId(projectId)
                .ownerUserId(userId)
                .nodeId(nodeId)
                .kind(compiled.kind())
                .status(IpRun.STATUS_RUNNING)
                .stage("queued")
                .pct(2)
                .cost(total)
                .inputJson(writeJson(compiled.inputs()))
                .createdAt(Instant.now())
                .heartbeatAt(Instant.now())
                .build();
        runRepo.save(run);
        log.info("[ipstudio] 运行受理 run={} project={} node={} kind={} count={} hold={}",
                runId, projectId, nodeId, compiled.kind(), compiled.count(), total);

        // 派发必须等事务提交：worker 在自己的线程 / 事务里 findById，commit 前读不到这一行，
        // 会直接「找不到运行」返回，任务永远停在 queued（真联调踩到；单测 worker 是 mock 看不出来）。
        // 范式同 MusicGenJobService / MaterialVideoJobService。
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatch(runId);
                }
            });
        } else {
            dispatch(runId);
        }
        return projects.toRunDto(run);
    }

    /**
     * 派发到 {@code ipRunExecutor}。
     *
     * <p>线程池排满（core 3 + queue 128 全占）时 {@code @Async} 抛
     * {@link TaskRejectedException}：此时 hold 已经冻上、run 行已经落库，
     * 谁都不会再来跑它 —— 不接住就是「用户看着一个永远 running 的节点，钱冻在 pending 桶里
     * 等三小时后的 CreditHoldSweeper」。afterCommit 跑在事务之外，所以收尾必须借
     * worker 上的 {@code REQUIRES_NEW} 方法自己开一个事务。
     */
    private void dispatch(String runId) {
        try {
            worker.execute(runId);
        } catch (TaskRejectedException e) {
            log.warn("[ipstudio] 运行队列已满，拒绝派发 run={}", runId);
            worker.abandon(runId, "IP_RUN_QUEUE_FULL", "生成队列已排满，积分已退回，请稍后再试");
        }
    }

    public IpRunDto get(String userId, String runId) {
        return projects.toRunDto(requiredRun(userId, runId));
    }

    public IpRun requiredRun(String userId, String runId) {
        return runRepo.findByIdAndOwnerUserId(runId, userId)
                .orElseThrow(() -> BusinessException.notFound("IP_RUN_NOT_FOUND", "运行记录不存在"));
    }

    /**
     * 取消：只置标记，终态由 worker 落 —— 两边都写终态会互相覆盖，
     * 同 {@code DapJobService.cancel} 的处理。
     */
    @Transactional
    public IpRunDto cancel(String userId, String runId) {
        IpRun run = requiredRun(userId, runId);
        if (IpRun.STATUS_RUNNING.equals(run.getStatus())) {
            run.setCancelRequested(true);
            runRepo.save(run);
        }
        return projects.toRunDto(run);
    }

    // ── 编译：identity ────────────────────────────────────────

    /** 编译产物：kind / 单价 / 张数 / 出 wire 的 inputs（内部执行参数在 {@code inputs._exec}）。 */
    public record Compiled(String kind, long unitCost, int count, String holdLabel,
                           ObjectNode inputs, boolean needsChat, boolean needsImage,
                           String promptKey) {}

    /**
     * 编译一次生成。
     *
     * <p><b>v0.157 起只有这一种编译</b>。此前是「照片 / 特征卡 / 风格 / 形象卡」四类定型节点各出一段，
     * 一张图要连四个节点才跑得起来。画布换成通用节点之后：<b>要画什么写在节点自己的提示词里，
     * 参考图就是连进来的上游图</b>——一致性不靠节点类型强制，靠把上游图当参考喂下去。
     *
     * <p>顺序仍是硬约束：这里只做编译与校验，**不碰钱**；preflight 与 hold 都在调用方，
     * 且 preflight 一定在 hold 之前（§8.0）。
     */
    Compiled compileGeneration(String userId, String projectId, JsonNode doc, JsonNode node) {
        String nodeId = node.path("id").asText(null);
        JsonNode md = IpDocs.metadataOf(node);

        List<String> missing = new ArrayList<>();
        String prompt = IpDocs.text(md, "prompt");
        if (prompt == null) missing.add("prompt");
        requireNoMissing(missing);

        // ── 参考图：上游连进来的图，近的排前面 ────────────────────────────
        // 归属闸：只认本人本项目上传或生成的 key。别人的 key 连进来就是越权读图，
        // 而画布文档是客户端拥有的，客户端能塞任何字符串进来。
        List<Ref> refs = new ArrayList<>();
        for (JsonNode up : IpDocs.referenceChain(doc, nodeId)) {
            // 归属闸：非本人的 key 直接 400，不是「跳过这一张」——
            // 画布文档是客户端拥有的，客户端能往里塞任何字符串（既有 requireOwnedAssetKey 的纪律）。
            String key = projects.requireOwnedAssetKey(userId, IpDocs.primaryStorageKey(up));
            if (key == null) continue;
            String title = IpDocs.text(up, "title");
            refs.add(new Ref("reference", key, title == null ? "参考图" : title));
            if (refs.size() >= props.getMaxRefImages()) break;
        }

        int count = normalizeCount(md);
        String size = normalizeSize(md);

        // ── 提示词模板（服务端唯一漏斗；用户能在 inputs.prompt 看到原文）────
        PromptService.ResolvedPrompt p = prompts.resolve(PromptService.KEY_DAP_IP_CANVAS_IMAGE);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("prompt", prompt);
        vars.put("refNotes", refs.isEmpty() ? "" : refNotes(refs));
        String finalPrompt = squeeze(PromptService.fill(p.userTemplate(), vars));

        ArrayNode refsOut = om.createArrayNode();
        ArrayNode refKeys = om.createArrayNode();
        for (int i = 0; i < refs.size(); i++) {
            Ref r = refs.get(i);
            ObjectNode item = refsOut.addObject();
            item.put("role", r.role());
            item.put("note", r.note());
            item.put("applied", true);
            ObjectNode k = refKeys.addObject();
            k.put("role", r.role());
            k.put("key", r.key());
            k.put("refIndex", i);
        }

        ObjectNode inputs = om.createObjectNode();
        inputs.put("prompt", finalPrompt);
        inputs.set("refs", refsOut);
        inputs.put("size", size);
        inputs.put("count", count);
        ObjectNode exec = inputs.putObject("_exec");
        exec.set("refKeys", refKeys);

        return new Compiled(IpRun.KIND_GENERATE, pricing.ipImage(), count,
                "画布出图 ×" + count, inputs, false, true,
                PromptService.KEY_DAP_IP_CANVAS_IMAGE);
    }

    /** 显式生成请求 —— 画布把「画什么、参考谁、出几张」说清楚。 */
    public record IpGenerateRequest(String nodeId, String prompt, List<String> refKeys,
                                    Integer count, String size, String model) {}

    /**
     * 编译一次显式生成。与按节点编译共用同一套提示词模板与计价，
     * 差别只在参考图从哪来：这里是画布点名的，那里是从文档回溯的。
     */
    Compiled compileExplicit(String userId, IpGenerateRequest req) {
        List<Ref> refs = new ArrayList<>();
        if (req.refKeys() != null) {
            for (String raw : req.refKeys()) {
                // 归属闸：非本人的 key 直接 400。画布是客户端，能塞任何字符串进来。
                String key = projects.requireOwnedAssetKey(userId, raw);
                if (key == null) continue;
                refs.add(new Ref("reference", key, "参考图"));
                if (refs.size() >= props.getMaxRefImages()) break;
            }
        }

        int count = req.count() == null ? 1 : Math.max(1, Math.min(4, req.count()));
        String size = req.size() == null || req.size().isBlank() ? DEFAULT_SIZE : req.size();
        if (!ALLOWED_SIZES.contains(size)) size = DEFAULT_SIZE;

        PromptService.ResolvedPrompt p = prompts.resolve(PromptService.KEY_DAP_IP_CANVAS_IMAGE);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("prompt", req.prompt().trim());
        vars.put("refNotes", refs.isEmpty() ? "" : refNotes(refs));
        String finalPrompt = squeeze(PromptService.fill(p.userTemplate(), vars));

        ArrayNode refsOut = om.createArrayNode();
        ArrayNode refKeys = om.createArrayNode();
        for (int i = 0; i < refs.size(); i++) {
            Ref r = refs.get(i);
            refsOut.addObject().put("role", r.role()).put("note", r.note()).put("applied", true);
            refKeys.addObject().put("role", r.role()).put("key", r.key()).put("refIndex", i);
        }

        ObjectNode inputs = om.createObjectNode();
        inputs.put("prompt", finalPrompt);
        inputs.set("refs", refsOut);
        inputs.put("size", size);
        inputs.put("count", count);
        ObjectNode exec = inputs.putObject("_exec");
        exec.set("refKeys", refKeys);
        if (req.model() != null && !req.model().isBlank()) exec.put("endpointId", req.model().trim());

        return new Compiled(IpRun.KIND_GENERATE, pricing.ipImage(), count,
                "画布出图 ×" + count, inputs, false, true,
                PromptService.KEY_DAP_IP_CANVAS_IMAGE);
    }

    /** 参考图说明：让模型知道每张参考图是干嘛的，也让用户在提示词原文里看得见。 */
    private static String refNotes(List<Ref> refs) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < refs.size(); i++) {
            sb.append("Reference image ").append(i + 1).append(": ").append(refs.get(i).note()).append(". ");
        }
        return sb.toString().trim();
    }

    private record Ref(String role, String key, String note) {}


    // ── preflight（§8.0：一定在 hold 之前）───────────────────

    void preflight(Compiled c) {
        if (c.needsChat() && (multimodal.chatModel() == null || multimodal.chatModel().isBlank())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DAP_ENGINE_NOT_CONFIGURED",
                    "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 人设」用途绑定一个支持图片输入的模型");
        }
        if (c.needsImage() && (multimodal.imageModel() == null || multimodal.imageModel().isBlank())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "DAP_ENGINE_NOT_CONFIGURED",
                    "形象引擎未配置：请在管理后台「AI 应用绑定」为「数字人 · 图片」用途绑定启用端点");
        }
        PromptService.ResolvedPrompt p = prompts.resolve(c.promptKey());
        if (p == null || "code".equals(p.origin())) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED",
                    "提示词模板未配置（" + c.promptKey() + "）：请在管理后台「Prompt 管理」补齐后重试");
        }
    }

    // ── doc 取值小工具 ────────────────────────────────────────


    /** 老画布的五字段，按这个顺序拼接（顺序即历史行为，不要改）。 */
    private static final List<String> LOOK_LEGACY_FIELDS =
            List.of("outfit", "pose", "expression", "details", "props");

    /**
     * 形象卡文本。
     *
     * <p><b>通用化（v0.153）</b>：新节点只写一个 {@code prompt} 字段 ——
     * 原来的 {@code outfit/pose/expression/details/props} 五个字段在这里做的事
     * 一直只是「按顺序拼成一串文本」，服务端从不区分它们的语义，拆分对出图零增益，
     * 只留下填写负担和边界犹豫（见 docs/ip-studio-generalize-proposal.md）。
     *
     * <p>老画布的 doc 里仍是五字段，所以这里保留回落拼接 —— <b>零迁移</b>：
     * 历史项目不用改数据、不用停机，读的时候按老顺序拼起来即可。
     */
    /**
     * 形象卡 → 提示词模板的五个占位符。
     *
     * <p>模板（{@code dap.ip_look_image}）里这五个占位符只是被顺序拼进同一句话，
     * 服务端从不区分它们的语义。新画布只写一个自由 {@code prompt}，就整段塞进第一个占位符 ——
     * <b>不改模板</b>：运营在后台存过自定义模板的实例，占位符名一旦变了他们那份就渲染不出内容。
     *
     * <p>老画布（只有五字段）逐字保持原行为。
     */
    private static Map<String, String> lookClauses(JsonNode lookData) {
        Map<String, String> vars = new LinkedHashMap<>();
        for (String f : LOOK_LEGACY_FIELDS) vars.put(f, "");
        String prompt = IpDocs.text(lookData, "prompt");
        if (prompt != null) {
            vars.put("outfit", clause("Look", prompt));
            return vars;
        }
        vars.put("outfit", clause("Outfit", IpDocs.text(lookData, "outfit")));
        vars.put("pose", clause("Pose", IpDocs.text(lookData, "pose")));
        vars.put("expression", clause("Expression", IpDocs.text(lookData, "expression")));
        vars.put("details", clause("Details", IpDocs.text(lookData, "details")));
        vars.put("props", clause("Props", IpDocs.text(lookData, "props")));
        return vars;
    }

    private static List<String> lookText(JsonNode lookData) {
        String prompt = IpDocs.text(lookData, "prompt");
        if (prompt != null) return List.of(prompt);
        List<String> out = new ArrayList<>();
        for (String f : LOOK_LEGACY_FIELDS) {
            String v = IpDocs.text(lookData, f);
            if (v != null) out.add(v);
        }
        return out;
    }

    private static int normalizeCount(JsonNode gd) {
        int raw = gd == null ? 1 : gd.path("count").asInt(1);
        return raw >= 4 ? 4 : raw >= 2 ? 2 : 1;
    }

    private static String normalizeSize(JsonNode gd) {
        String raw = IpDocs.text(gd, "size");
        return raw != null && ALLOWED_SIZES.contains(raw) ? raw : DEFAULT_SIZE;
    }

    private void requireNoMissing(List<String> missing) {
        if (missing.isEmpty()) return;
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("missing", missing);
        throw new BusinessException(HttpStatus.BAD_REQUEST, "IP_NODE_INPUT_MISSING",
                "还缺少必要输入：" + String.join("、", missing.stream().map(IpRunService::missingLabel).toList()),
                details);
    }

    private static String missingLabel(String key) {
        return switch (key) {
            case "source" -> "用户照片";
            case "identity", "identity.promptEn" -> "人物特征卡";
            case "style", "style.promptEn" -> "风格";
            case "look" -> "形象卡内容";
            default -> key;
        };
    }

    private static String clause(String label, String value) {
        return value == null ? "" : label + ": " + value + ".";
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** 模板里空占位符会留下多余空格 / 残留 {{x}}，一起收干净。 */
    static String squeeze(String s) {
        if (s == null) return "";
        return s.replaceAll("\\{\\{[^}]*}}", " ").replaceAll("\\s+", " ").trim();
    }

    private String writeJson(JsonNode n) {
        try {
            return om.writeValueAsString(n);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String uniqueRunId() {
        for (int i = 0; i < 20; i++) {
            String id = "IPR-" + IpProjectService.hex8();
            if (!runRepo.existsById(id)) return id;
        }
        return "IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
