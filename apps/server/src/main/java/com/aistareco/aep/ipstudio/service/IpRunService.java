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
                        ObjectMapper om) {
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
        if (!IpDocs.T_IDENTITY.equals(type) && !IpDocs.T_GENERATE.equals(type)) {
            throw BusinessException.badRequest("IP_NODE_NOT_RUNNABLE", "该节点不需要运行");
        }
        if (!runRepo.findByProjectIdAndNodeIdAndStatus(projectId, nodeId, IpRun.STATUS_RUNNING).isEmpty()) {
            throw new BusinessException(HttpStatus.CONFLICT, "IP_RUN_ALREADY_RUNNING",
                    "该节点正在生成中，请等它完成后再运行");
        }

        // 输入编译（含缺失校验 + 资产 key 归属闸）—— 全部在 hold 之前
        Compiled compiled = IpDocs.T_IDENTITY.equals(type)
                ? compileIdentity(userId, projectId, doc, node)
                : compileGenerate(userId, projectId, doc, node);

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

    Compiled compileIdentity(String userId, String projectId, JsonNode doc, JsonNode node) {
        List<String> missing = new ArrayList<>();
        String sourceKey = firstSourceKey(userId, doc, node.path("id").asText(null));
        if (sourceKey == null) missing.add("source");
        requireNoMissing(missing);

        PromptService.ResolvedPrompt p = prompts.resolve(PromptService.KEY_DAP_IP_IDENTITY);
        String system = p.system();
        String user = PromptService.fill(p.userTemplate(), Map.of());

        ObjectNode inputs = om.createObjectNode();
        inputs.put("count", 1);
        ObjectNode exec = inputs.putObject("_exec");
        exec.put("sourceKey", sourceKey);
        exec.put("system", system == null ? "" : system);
        exec.put("user", user == null ? "" : user);
        ArrayNode refs = inputs.putArray("refs");
        ObjectNode r = refs.addObject();
        r.put("role", "source");
        r.put("applied", true);

        return new Compiled(IpRun.KIND_IDENTITY, pricing.ipIdentity(), 1, "IP 人物特征卡抽取",
                inputs, true, false, PromptService.KEY_DAP_IP_IDENTITY);
    }

    // ── 编译：generate ────────────────────────────────────────

    /**
     * 编译一次出图。
     *
     * <p>与 plan §4.3 的差异（已在最终报告标注）：{@code look} 只在**非主形象**节点上必填。
     * 模板里 master generate 直接挂在 style 之后、没有 look 上游（§6），
     * 把 look 也列为硬必填会让主形象节点永远跑不起来。
     */
    Compiled compileGenerate(String userId, String projectId, JsonNode doc, JsonNode node) {
        String nodeId = node.path("id").asText(null);
        JsonNode gd = IpDocs.dataOf(node);
        boolean isMaster = gd != null && gd.path("isMaster").asBoolean(false);

        List<String> missing = new ArrayList<>();

        // ① 身份文本
        List<JsonNode> identityNodes = IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_IDENTITY, ANCESTOR_DEPTH);
        String identityPrompt = null;
        String identityText = null;
        if (identityNodes.isEmpty()) {
            missing.add("identity");
        } else {
            JsonNode d = IpDocs.dataOf(identityNodes.get(0));
            identityPrompt = IpDocs.text(d, "promptEn");
            identityText = IpDocs.text(d, "text");
            if (identityPrompt == null && identityText == null) missing.add("identity.promptEn");
        }

        // ② 风格（节点自带 promptEn 优先；只给 presetId 时回落内置预设）
        List<JsonNode> styleNodes = IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_STYLE, ANCESTOR_DEPTH);
        String stylePrompt = null;
        String styleNegative = null;
        if (styleNodes.isEmpty()) {
            missing.add("style");
        } else {
            JsonNode d = IpDocs.dataOf(styleNodes.get(0));
            stylePrompt = IpDocs.text(d, "promptEn");
            styleNegative = IpDocs.text(d, "negativeEn");
            String presetId = IpDocs.text(d, "presetId");
            if (presetId != null) {
                IpStylePresetDto preset = catalog.style(presetId).orElse(null);
                if (preset != null) {
                    if (stylePrompt == null) stylePrompt = trimToNull(preset.promptEn());
                    if (styleNegative == null) styleNegative = trimToNull(preset.negativeEn());
                }
            }
            if (stylePrompt == null) missing.add("style.promptEn");
        }

        // ③ 形象卡（主形象节点可以没有）
        JsonNode lookData = null;
        List<JsonNode> lookNodes = IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_LOOK, 2);
        if (!lookNodes.isEmpty()) {
            lookData = IpDocs.dataOf(lookNodes.get(0));
            if (lookText(lookData).isEmpty()) missing.add("look");
        } else if (!isMaster) {
            missing.add("look");
        }

        requireNoMissing(missing);

        // ④ 参考图装配：master → source → reference…（超上限按此顺序砍尾，如实回报）
        List<Ref> candidates = new ArrayList<>();
        String masterKey = masterCandidateKey(userId, projectId, doc, nodeId);
        if (masterKey != null) candidates.add(new Ref("master", masterKey, null));
        String sourceKey = firstSourceKey(userId, doc, nodeId);
        if (sourceKey != null) candidates.add(new Ref("source", sourceKey, null));
        List<String> refNotes = new ArrayList<>();
        int refIdx = 0;
        for (JsonNode refNode : IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_REFERENCE, 3)) {
            JsonNode d = IpDocs.dataOf(refNode);
            // 客户端写的 key 一律过归属闸（非本人的 key / 带 .. 的路径 → 400，不进模型请求）
            String key = projects.requireOwnedAssetKey(userId, IpDocs.text(d, "assetKey"));
            if (key == null) continue;
            refIdx++;
            String note = IpDocs.text(d, "note");
            candidates.add(new Ref("reference", key, note));
            refNotes.add("Reference image " + refIdx + (note == null ? "" : ": " + note));
        }

        int max = Math.max(1, props.getMaxRefImages());
        ArrayNode refsOut = om.createArrayNode();
        ArrayNode refKeys = om.createArrayNode();
        int applied = 0;
        for (Ref ref : candidates) {
            int refIndex = refsOut.size();
            ObjectNode item = refsOut.addObject();
            item.put("role", ref.role());
            if (applied >= max) {
                item.put("applied", false);
                item.put("reason", "over_max_refs");
                continue;
            }
            item.put("applied", true);
            // refKeys 带上 role 与它在 refs[] 里的下标：worker 遇到读不到的参考图时，
            // 才能区分「身份锚（master/source）不可读 → 必须失败退款」与
            // 「可选局部参考不可读 → 标 applied=false 继续」，并如实回写到那一条上。
            ObjectNode k = refKeys.addObject();
            k.put("role", ref.role());
            k.put("key", ref.key());
            k.put("refIndex", refIndex);
            applied++;
        }

        // ⑤ 提示词模板拼装（服务端唯一漏斗；用户能在 inputs.prompt 看到原文）
        PromptService.ResolvedPrompt p = prompts.resolve(PromptService.KEY_DAP_IP_LOOK_IMAGE);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("style", nz(stylePrompt));
        vars.put("identity", nz(identityPrompt != null ? identityPrompt : identityText));
        vars.put("outfit", clause("Outfit", IpDocs.text(lookData, "outfit")));
        vars.put("pose", clause("Pose", IpDocs.text(lookData, "pose")));
        vars.put("expression", clause("Expression", IpDocs.text(lookData, "expression")));
        vars.put("details", clause("Details", IpDocs.text(lookData, "details")));
        vars.put("props", clause("Props", IpDocs.text(lookData, "props")));
        vars.put("refNotes", refNotes.isEmpty() ? "" : String.join(" ", refNotes));
        vars.put("negative", nz(styleNegative));
        String prompt = squeeze(PromptService.fill(p.userTemplate(), vars));

        int count = normalizeCount(gd);
        String size = normalizeSize(gd);

        ObjectNode inputs = om.createObjectNode();
        inputs.put("prompt", prompt);
        inputs.set("refs", refsOut);
        inputs.put("size", size);
        inputs.put("count", count);
        ObjectNode exec = inputs.putObject("_exec");
        exec.set("refKeys", refKeys);
        exec.put("isMaster", isMaster);

        return new Compiled(IpRun.KIND_GENERATE, pricing.ipImage(), count,
                (isMaster ? "IP 主形象生成 ×" : "IP 形象卡出图 ×") + count,
                inputs, false, true, PromptService.KEY_DAP_IP_LOOK_IMAGE);
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

    /** 上游 master generate 的选中候选 key（selectedRunId + selectedIndex 指向的那张）。 */
    String masterCandidateKey(String userId, String projectId, JsonNode doc, String nodeId) {
        List<JsonNode> gens = IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_GENERATE, ANCESTOR_DEPTH);
        JsonNode chosen = null;
        for (JsonNode g : gens) {
            JsonNode d = IpDocs.dataOf(g);
            if (d != null && d.path("isMaster").asBoolean(false)) { chosen = g; break; }
        }
        if (chosen == null && !gens.isEmpty()) chosen = gens.get(0);
        if (chosen == null) return null;
        JsonNode d = IpDocs.dataOf(chosen);
        String runId = IpDocs.text(d, "selectedRunId");
        if (runId == null) return null;
        int idx = d.path("selectedIndex").asInt(0);
        // 归属不符 → 抛 404 IP_RUN_NOT_FOUND（见 candidateKeyOf 注释），不静默当「没选主图」
        return projects.candidateKeyOf(userId, projectId, runId, idx);
    }

    /** 上游第一张照片的 key —— 同样过归属闸，非本人 key 直接 400 而不是「跳过这一张」。 */
    private String firstSourceKey(String userId, JsonNode doc, String nodeId) {
        for (JsonNode n : IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_SOURCE, ANCESTOR_DEPTH)) {
            String key = projects.requireOwnedAssetKey(userId, IpDocs.text(IpDocs.dataOf(n), "assetKey"));
            if (key != null) return key;
        }
        return null;
    }

    private static List<String> lookText(JsonNode lookData) {
        List<String> out = new ArrayList<>();
        for (String f : List.of("outfit", "pose", "expression", "details", "props")) {
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
