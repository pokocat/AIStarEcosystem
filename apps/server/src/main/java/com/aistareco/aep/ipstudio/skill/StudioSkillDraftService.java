package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.DraftRequest;
import com.aistareco.aep.ipstudio.execution.IpPlanExecution;
import com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository;
import com.aistareco.aep.ipstudio.execution.StudioPlanSource;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.service.StudioWorkflowWorker;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiAppSceneModelPolicyService;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Operator-only: turn a finished canvas execution into a draft revision of its skill (S3 §从成功画布整理方法草稿).
 *
 * <p>Accepts a token-priced text run (operation {@code text}, purpose {@code skill-distill}) with the usual Studio
 * acceptance discipline: price and prompt checked before anything is frozen, the user's approved ceiling required, hold
 * (personal or enterprise) in the same transaction as the run row, dispatch after commit. The worker settles on real
 * usage and {@link StudioSkillDraftSink} saves the draft in that same settlement transaction. A draft never activates by
 * itself; an admin reviews and publishes it.
 *
 * <p>The model sees the current skill body and a structured record of the execution (approaches, per-step outcomes,
 * attempts, check verdicts, which results the user adopted) — never step prompts, user messages or storage keys.
 */
@Service
public class StudioSkillDraftService {
    private static final Logger log = LoggerFactory.getLogger(StudioSkillDraftService.class);
    private static final Pattern CLIENT_ID = Pattern.compile("[A-Za-z0-9_.:-]{1,64}");
    static final String PURPOSE = "skill-distill";
    static final int SKILL_BODY_MAX = 24000, MATERIAL_MAX = 20000;

    private final IpProjectService projects;
    private final IpRunRepository runs;
    private final IpPlanExecutionRepository executions;
    private final StudioSkillStore store;
    private final PromptService prompts;
    private final AiModelInvocationService models;
    private final DapPricingService pricing;
    private final CreditService credits;
    private final StudioFixtureProvider fixtures;
    private final StudioWorkflowWorker worker;
    private final ObjectProvider<AiAppSceneModelPolicyService> scenePolicies;
    private final ObjectProvider<AiChatTokenPricing> tokenPricing;
    private final ObjectProvider<EnterpriseBillingService> enterpriseBilling;
    private final ObjectProvider<StudioPlanSource> planSources;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;

    public StudioSkillDraftService(IpProjectService projects, IpRunRepository runs, IpPlanExecutionRepository executions, StudioSkillStore store,
                                   PromptService prompts, AiModelInvocationService models, DapPricingService pricing, CreditService credits,
                                   StudioFixtureProvider fixtures, StudioWorkflowWorker worker,
                                   ObjectProvider<AiAppSceneModelPolicyService> scenePolicies, ObjectProvider<AiChatTokenPricing> tokenPricing,
                                   ObjectProvider<EnterpriseBillingService> enterpriseBilling, ObjectProvider<StudioPlanSource> planSources,
                                   ObjectMapper mapper, PlatformTransactionManager manager) {
        this.projects = projects; this.runs = runs; this.executions = executions; this.store = store; this.prompts = prompts;
        this.models = models; this.pricing = pricing; this.credits = credits; this.fixtures = fixtures; this.worker = worker;
        this.scenePolicies = scenePolicies; this.tokenPricing = tokenPricing; this.enterpriseBilling = enterpriseBilling;
        this.planSources = planSources; this.mapper = mapper; this.tx = new TransactionTemplate(manager);
    }

    public IpRunDto submit(String userId, String projectId, DraftRequest request, boolean operator) {
        if (!operator) throw new BusinessException(HttpStatus.FORBIDDEN, "STUDIO_SKILL_DRAFT_FORBIDDEN", "只有运营可以把画布整理成制作方法草稿");
        if (request == null || request.clientRequestId() == null || !CLIENT_ID.matcher(request.clientRequestId()).matches())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请求编号无效");
        if (request.executionId() == null || request.executionId().isBlank() || request.executionId().length() > 64)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "请选择要整理的那次制作");
        if (request.note() != null && request.note().length() > 1000) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "整理重点最多 1000 字");
        if (request.maxCost() != null && request.maxCost() < 0) throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "费用上限不能为负");
        return tx.execute(s -> accept(userId, projectId, request));
    }

    private IpRunDto accept(String userId, String projectId, DraftRequest request) {
        projects.requiredForUpdate(userId, projectId);
        String note = request.note() == null ? "" : request.note().strip();
        String fingerprint = StudioSkillCatalog.digest(PURPOSE + "\n" + request.executionId() + "\n" + note);
        IpRun prior = runs.findByProjectIdAndClientRequestId(projectId, request.clientRequestId()).orElse(null);
        if (prior != null) {
            boolean enterprise = request.billing() != null && "enterprise".equals(request.billing().mode());
            if (!fingerprint.equals(prior.getInputFingerprint()) || enterprise != (prior.getEnterpriseId() != null)
                    || enterprise && !Objects.equals(prior.getEnterpriseId(), request.billing().enterpriseId()))
                throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_REQUEST_CHANGED", "同一请求的内容已改变，请重新提交");
            return projects.toRunDto(prior);
        }
        IpPlanExecution execution = executions.findById(request.executionId())
                .filter(e -> userId.equals(e.getOwnerUserId()) && projectId.equals(e.getProjectId()))
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STUDIO_PLAN_EXECUTION_NOT_FOUND", "这次连续制作不存在或已结束"));
        if (!IpPlanExecution.DONE.equals(execution.getStatus()) && !IpPlanExecution.PARTIAL.equals(execution.getStatus()))
            throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_SKILL_DRAFT_NOT_READY", "这次制作还没做完；做完或部分完成之后才能整理成方法草稿");
        if (fixtures.enabled())
            throw BusinessException.badRequest("STUDIO_SKILL_DRAFT_UNAVAILABLE", "测试响应不支持整理制作方法，请关闭测试响应");
        IpSkill skillRow = store.skills().findById(execution.getSkillKey()).orElseThrow(StudioSkillCatalog::notFound);
        if (IpSkill.WITHDRAWN.equals(skillRow.getStatus())) throw StudioSkillCatalog.notFound();
        IpSkillVersion base = store.versions().findBySkillKeyAndVersion(skillRow.getSkillKey(), skillRow.getCurrentVersion())
                .orElseThrow(StudioSkillCatalog::notFound);
        if (base.getBodyMd().length() > SKILL_BODY_MAX)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID", "这个制作方法的正文太长，暂时不能自动整理，请在后台直接编辑");

        // Price, prompt and endpoint before anything is frozen (§8.0: no endpoint / price / prompt → refuse, nothing held).
        AiModelEndpoint endpoint = endpoint();
        PromptService.ResolvedPrompt prompt = prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DISTILL);
        if ("code".equals(prompt.origin())) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PROMPT_NOT_CONFIGURED", "尚未配置整理制作方法的提示词");
        var pricingService = tokenPricing.getIfAvailable();
        AiChatTokenPricing.Rate rate = pricingService == null ? null : pricingService.find(endpoint.getId());
        if (rate == null) throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_TOKEN_PRICE_NOT_CONFIGURED", "此模型尚未配置按量积分售价");
        long cost = rate.maxCost();
        if (request.maxCost() == null) throw new BusinessException(HttpStatus.CONFLICT, "STUDIO_PRICE_CHANGED", "模型计费配置已更新，请刷新后重试");
        IpRunService.requireApprovedCost(request.maxCost(), cost);

        List<String> fragments = new ArrayList<>();
        ObjectNode material = material(userId, execution, fragments);
        Map<String, String> vars = new LinkedHashMap<>();
        vars.put("skillName", skillRow.getName());
        vars.put("baseVersion", String.valueOf(base.getVersion()));
        vars.put("executionVersion", String.valueOf(execution.getSkillVersion()));
        vars.put("skill", base.getBodyMd());
        String materialText = material.toString();
        vars.put("execution", materialText.length() > MATERIAL_MAX ? materialText.substring(0, MATERIAL_MAX) : materialText);
        vars.put("note", note.isEmpty() ? "无。" : note);
        int maxTokens = Math.min(Math.max(8192, prompt.params().maxTokensOrDefault()), rate.maxOutputTokens());
        if (endpoint.getChatMaxOutputTokens() != null) maxTokens = Math.min(maxTokens, endpoint.getChatMaxOutputTokens());

        String id = "IPR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        ObjectNode input = mapper.createObjectNode().put("operation", "text").put("purpose", PURPOSE).put("nodeId", "SKD-" + execution.getId())
                .put("clientRequestId", request.clientRequestId()).put("executionId", execution.getId()).put("skillKey", skillRow.getSkillKey())
                .put("maxCost", request.maxCost()).put("mock", false).put("promptKey", PromptService.KEY_DAP_IP_STUDIO_SKILL_DISTILL);
        if (!note.isEmpty()) input.put("note", note);
        if (request.billing() != null) input.set("billing", mapper.valueToTree(request.billing()));
        ObjectNode exec = input.putObject("_exec").put("holdTotal", cost).put("unitCost", cost).put("billingUnit", "per_token")
                .put("endpointId", endpoint.getId()).put("systemPrompt", prompt.system()).put("userPrompt", PromptService.fill(prompt.userTemplate(), vars))
                .put("temperature", 0.3).put("maxTokens", maxTokens);
        exec.set("tokenPricing", mapper.valueToTree(rate));
        ObjectNode distill = exec.putObject("skillDistill").put("skillKey", skillRow.getSkillKey()).put("baseVersion", base.getVersion())
                .put("executionId", execution.getId()).put("executionSkillVersion", execution.getSkillVersion());
        if (!note.isEmpty()) distill.put("note", note);
        var headings = distill.putArray("baseHeadings");
        StudioSkillDistill.headings(base.getBodyMd()).forEach(headings::add);
        var privateFragments = distill.putArray("privateFragments");
        fragments.stream().distinct().limit(200).forEach(privateFragments::add);

        var billingService = enterpriseBilling.getIfAvailable();
        var modelCharge = com.aistareco.aep.ipstudio.service.StudioTokenBilling.plan(endpoint, rate);
        com.aistareco.aep.ipstudio.service.StudioTokenBilling.store(exec, modelCharge, endpoint);
        var account = billingService == null ? null : billingService.reserve(userId, request.billing(), IpRunService.REF_TYPE, id, endpoint.getId(), cost, "Studio 整理制作方法", modelCharge);
        if (billingService == null && cost > 0) credits.hold(userId, cost, IpRunService.REF_TYPE, id, "Studio 整理制作方法", modelCharge);
        Instant now = Instant.now();
        IpRun run = IpRun.builder().id(id).projectId(projectId).ownerUserId(userId).nodeId("SKD-" + execution.getId()).kind("studio-text")
                .status(IpRun.STATUS_RUNNING).stage("queued").cost(cost).clientRequestId(request.clientRequestId()).inputFingerprint(fingerprint)
                .inputJson(input.toString()).outputJson("{}").createdAt(now).heartbeatAt(now).build();
        if (account != null) {
            run.setBillingWalletId(account.walletId()); run.setEnterpriseId(account.enterpriseId());
            run.setMembershipId(account.membershipId()); run.setBillingAuthorizationId(account.billingAuthorizationId());
        }
        runs.save(run);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { worker.execute(id); } catch (RuntimeException e) { worker.reject(id, e); }
            }
        });
        log.info("[studio-skill] distill accepted run={} skill={} base=v{} execution={} cost={}", id, skillRow.getSkillKey(), base.getVersion(), execution.getId(), cost);
        return projects.toRunDto(run);
    }

    /** Same endpoint resolution as Studio text runs (scene studio/script default); the worker re-checks it at dispatch. */
    private AiModelEndpoint endpoint() {
        var policies = scenePolicies.getIfAvailable();
        if (policies != null) return policies.resolve("studio", "script", null, pricing.ipIdentity()).resolved().endpoint();
        return models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA, null, "studio").map(AiModelInvocationService.ResolvedEndpoint::endpoint)
                .orElseThrow(() -> new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "AI_NOT_CONFIGURED",
                        "还没有配置可用的文本模型：请在后台「AI 模型」里为 Studio 创作绑定默认文本模型"));
    }

    /**
     * Structured record of the execution for the model: approaches (from the confirmed plans), per-step outcome, attempts,
     * whether the user adopted the result, check verdicts with item reasons. No step prompts, user messages or keys.
     * Free-text plan fields go into {@code fragments} so the server can strip any verbatim copy from the draft.
     */
    ObjectNode material(String userId, IpPlanExecution e, List<String> fragments) {
        ObjectNode state = parse(e.getStepsJson()), budget = parse(e.getBudgetJson());
        ObjectNode out = mapper.createObjectNode().put("status", e.getStatus()).put("lastStage", e.getStage());
        if (e.getStartedAt() != null && e.getFinishedAt() != null)
            out.put("durationMin", Math.max(0, Duration.between(e.getStartedAt(), e.getFinishedAt()).toMinutes()));
        ArrayNode stages = out.putArray("stages");
        for (String stage : List.of("analysis", "production")) {
            JsonNode b = budget.path(stage);
            if (!b.isObject()) continue;
            ObjectNode item = stages.addObject().put("stage", stage).put("approvedCap", b.path("approvedCap").asLong()).put("spent", b.path("spent").asLong());
            JsonNode plan = plan(userId, e.getProjectId(), b.path("planRunId").asText(null), b.path("planFingerprint").asText(null));
            if (plan == null) { item.put("plan", "方案原文不可用"); continue; }
            item.put("recommendedApproachId", plan.path("recommendedApproachId").asText(""));
            if (b.hasNonNull("approachId")) item.put("confirmedApproachId", b.path("approachId").asText());
            // Only abstract, case-free signals reach the distill model (Codex R6-01): titles, summaries, rationale,
            // preserve / change / tradeoff sentences all carry the user's own words (the plan quotes the brief back) and
            // are never forwarded, not even clipped. Their text still joins the private-fragment list so a model that
            // somehow echoes them is stripped before anything is stored.
            fragments.add(plan.path("summary").asText(""));
            ArrayNode approaches = item.putArray("approaches");
            for (JsonNode a : plan.path("approaches")) {
                ObjectNode approach = approaches.addObject().put("id", a.path("id").asText())
                        .put("recommended", a.path("id").asText().equals(plan.path("recommendedApproachId").asText("")))
                        .put("confirmed", b.hasNonNull("approachId") && a.path("id").asText().equals(b.path("approachId").asText()))
                        .put("preserveCount", a.path("preserve").size()).put("changeCount", a.path("change").size())
                        .put("tradeoffCount", a.path("tradeoffs").size());
                ArrayNode caps = approach.putArray("requiredCapabilities");
                for (JsonNode v : a.path("requiredCapabilities")) if (caps.size() < 8 && v.asText("").matches("[A-Za-z0-9_.:-]{1,64}")) caps.add(v.asText());
                for (String field : List.of("title", "summary", "rationale")) fragments.add(a.path(field).asText(""));
                for (String field : List.of("preserve", "change", "tradeoffs")) for (JsonNode v : a.path(field)) fragments.add(v.asText(""));
            }
        }
        ArrayNode steps = out.putArray("steps");
        for (JsonNode step : state.path("steps")) {
            JsonNode strategy = step.path("definition").path("strategy");
            // Step titles / reasons / notes are authored from the brief as well: structure only (R6-01).
            String method = strategy.path("method").asText("");
            ObjectNode item = steps.addObject().put("id", step.path("id").asText()).put("stage", step.path("stage").asText())
                    .put("operation", step.path("operation").asText())
                    .put("method", method.matches("[A-Za-z0-9_.:-]{1,64}") ? method : "")
                    .put("approachId", strategy.path("approachId").asText("")).put("status", step.path("status").asText())
                    .put("attempts", step.path("attempt").asInt(1)).put("runs", step.path("runIds").size())
                    .put("adopted", step.hasNonNull("acceptedRunId"));
            fragments.add(step.path("title").asText(""));
            fragments.add(strategy.path("reason").asText(""));
            if (step.hasNonNull("reason")) { item.put("stoppedByUser", true); fragments.add(step.path("reason").asText("")); }
            if ("check".equals(step.path("operation").asText()) && "done".equals(step.path("status").asText())) {
                item.put("verdict", step.path("checkStatus").asText("unknown"));
                JsonNode check = checkResult(userId, e.getProjectId(), step.path("runIds"));
                if (check != null) {
                    ArrayNode items = item.putArray("items");
                    for (JsonNode c : check.path("items")) {
                        // Check reasons are model prose about the frames (they name products, people and segments):
                        // id + verdict only; the prose joins the private fragments (R6-01).
                        items.addObject().put("id", c.path("id").asText()).put("status", c.path("status").asText())
                                .put("evidenceCount", c.path("evidence").size());
                        fragments.add(c.path("reason").asText(""));
                        fragments.add(c.path("suggestion").asText(""));
                    }
                }
            }
        }
        return out;
    }

    /** The confirmed plan of a stage: a native planning run's output.plan, or the dialogue's plan block, by fingerprint. */
    private JsonNode plan(String userId, String projectId, String planRunId, String fingerprint) {
        if (planRunId == null || fingerprint == null) return null;
        var run = projects.ownedRun(userId, projectId, planRunId).orElse(null);
        if (run == null) return null;
        JsonNode plan = parse(run.getOutputJson()).path("plan");
        if (plan.isObject() && fingerprint.equals(StudioPlanValidator.fingerprint(plan))) return plan;
        for (var source : planSources.orderedStream().toList()) {
            var record = source.find(userId, projectId, planRunId, fingerprint).orElse(null);
            if (record != null && record.plan() != null && record.plan().isObject()) return record.plan();
        }
        return null;
    }

    private JsonNode checkResult(String userId, String projectId, JsonNode runIds) {
        for (int i = runIds.size() - 1; i >= 0; i--) {
            var run = projects.ownedRun(userId, projectId, runIds.get(i).asText()).orElse(null);
            if (run == null || !IpRun.STATUS_DONE.equals(run.getStatus())) continue;
            JsonNode check = parse(run.getOutputJson()).path("check");
            if (check.isObject()) return check;
        }
        return null;
    }

    private ObjectNode parse(String json) {
        try {
            JsonNode node = json == null || json.isBlank() ? null : mapper.readTree(json);
            return node instanceof ObjectNode o ? o : mapper.createObjectNode();
        } catch (Exception e) { return mapper.createObjectNode(); }
    }

    private static String clip(String text, int max) { String t = text == null ? "" : text.strip(); return t.length() > max ? t.substring(0, max) : t; }
}
