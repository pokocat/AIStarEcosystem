package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueApprovals;
import com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval;
import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/**
 * User-facing commands of plan executions: create the analysis execution, confirm the production stage on the same
 * execution, read, pause, resume, cancel and accept. Every command is idempotent by its clientRequestId; every state
 * change bumps the lease version so a running advance stops at its next write, and the executor is woken after commit.
 */
@Service
public class StudioPlanExecutionService {
    private static final Logger log=LoggerFactory.getLogger(StudioPlanExecutionService.class);
    private static final Pattern REQUEST_ID=Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final List<String> ACTIVE=List.of(IpPlanExecution.RUNNING,IpPlanExecution.PAUSED,IpPlanExecution.NEEDS_USER);

    private final IpPlanExecutionRepository executions;
    private final IpProjectService projects;
    private final StudioSkillRules skills;
    private final StudioPlanOutputs outputs;
    private final ObjectProvider<StudioPlanExecutor> executor;
    private final ObjectProvider<StudioPlanSource> sources;
    private final ObjectMapper mapper;
    /** Enterprise payer check at confirmation; the native runs re-check the authorization at every hold. */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private com.aistareco.aep.enterprise.service.EnterpriseAccessService enterpriseAccess;
    /** The dialogue's approval cards: the only confirmation source (D02). Without it nothing can be confirmed (503). */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<StudioDialogueApprovals> approvals;
    /** Steering sent while the execution ran; a fresh confirmation or resume supersedes it (D03). */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering> steering;
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueService> dialogue;
    public StudioPlanExecutionService(IpPlanExecutionRepository executions,IpProjectService projects,StudioSkillRules skills,
            StudioPlanOutputs outputs,ObjectProvider<StudioPlanExecutor> executor,ObjectProvider<StudioPlanSource> sources,ObjectMapper mapper) {
        this.executions=executions;this.projects=projects;this.skills=skills;this.outputs=outputs;this.executor=executor;this.sources=sources;this.mapper=mapper;
    }

    // ── Create / confirm stage ───────────────────────────────────────────────────────────────────────────────────
    /** Button path: {@code confirmationMessageId} is the assistant message holding the clicked card. */
    @Transactional
    public PlanExecution create(String userId,String projectId,PlanExecutionCreateRequest req) {
        return create(userId,projectId,req,false);
    }

    /**
     * Natural-language path (D04), reached only through the dialogue's {@code confirm_approval} tool: the user approved a
     * pending card in words. Builds the same request the card button sends (plan, revision, approach, payer from the
     * card; caps from the user's words, never above the card unless the user said the higher number) and confirms it
     * through the same checks, with the user's own message as the confirmation source.
     */
    @Transactional
    public PlanExecution confirmNatural(String userId,String projectId,NaturalApproval approval) {
        if(approval==null||approval.clientRequestId()==null||!REQUEST_ID.matcher(approval.clientRequestId()).matches())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请求编号无效");
        projects.requiredForUpdate(userId,projectId);
        // A repeated tool call with the same approval is a replay: the card is already approved, the result is the same.
        var replay=executions.findByOwnerUserIdAndClientRequestId(userId,approval.clientRequestId()).filter(x->projectId.equals(x.getProjectId())).orElse(null);
        if(replay==null)for(var x:executions.findByProjectIdAndStatusIn(projectId,ACTIVE)) {
            JsonNode b=PlanState.parse(mapper,x.getBudgetJson());
            for(String st:StudioSkillRules.STAGES)if(userId.equals(x.getOwnerUserId())&&approval.clientRequestId().equals(b.path(st).path("clientRequestId").asText()))replay=x;
        }
        if(replay!=null)return toDto(replay);
        var card=cards().requireApprovalByMessage(userId,projectId,approval.userMessageId(),approval.approvalId());
        JsonNode block=card.block();
        long cap=approval.budgetCap()==null?block.path("budgetCap").asLong():approval.budgetCap();
        long autoFix=approval.autoFixCap()==null?block.path("autoFixCap").asLong(0):approval.autoFixCap();
        StudioNaturalApprovals.require(card.approvingText(),block,cap,autoFix);
        String stage=card.stage();
        BillingSelection billing=block.hasNonNull("billingSelection")?mapper.convertValue(block.path("billingSelection"),BillingSelection.class):null;
        var active=executions.findByProjectIdAndStatusIn(projectId,ACTIVE).stream().filter(x->userId.equals(x.getOwnerUserId())).findFirst().orElse(null);
        String executionId=null,approachId=null;
        if("production".equals(stage)) {
            var loaded=loadPlan(userId,projectId,card.cardPlanRunId(),card.planFingerprint(),"production");
            // A production-only skill (原创创作) starts its execution with this card; the reference-video skill needs its analysis first.
            if(active==null&&!"production".equals(loaded.rules().firstStage()))throw stale("还没有进行中的分析，不能直接确认制作方案");
            executionId=active==null?null:active.getId();
            approachId=loaded.plan().path("confirmedApproachId").asText(loaded.plan().path("recommendedApproachId").asText(null));
        } else if(active!=null&&stage.equals(active.getStage())) {
            executionId=active.getId(); // a raise of the running stage's cap, or a revised plan for it (replanStage)
        }
        var req=new PlanExecutionCreateRequest(approval.clientRequestId(),stage,card.cardPlanRunId(),card.planFingerprint(),approachId,cap,autoFix,
                billing,executionId,card.cardPlanRevision(),approval.approvalId(),approval.userMessageId());
        return create(userId,projectId,req,true);
    }

    private PlanExecution create(String userId,String projectId,PlanExecutionCreateRequest req,boolean byMessage) {
        validate(req);
        String fingerprint=StudioPlanExecutionIds.sha256(canonical(mapper.valueToTree(req)).toString());
        BillingSelection billing=EnterpriseBillingService.normalize(req.billing());
        projects.requiredForUpdate(userId,projectId); // serializes "one active execution per project"
        if(req.executionId()!=null)return confirmStage(userId,projectId,req,fingerprint,billing,byMessage);
        var prior=executions.findByOwnerUserIdAndClientRequestId(userId,req.clientRequestId()).orElse(null);
        if(prior!=null) {
            String stored=PlanState.parse(mapper,prior.getBudgetJson()).path(req.stage()).path("requestFingerprint").asText("");
            if(!projectId.equals(prior.getProjectId())||!fingerprint.equals(stored))throw changed();
            return toDto(prior);
        }
        if(!StudioSkillRules.STAGES.contains(req.stage()))throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请先开始分析，再在同一次制作里确认制作阶段");
        var busy=executions.findByProjectIdAndStatusIn(projectId,ACTIVE);
        if(!busy.isEmpty())throw new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_EXECUTION_BUSY","这张画布已经有一项连续制作在进行，请先结束它",
                mapper.createObjectNode().put("executionId",busy.get(0).getId()));
        // A new execution starts in its skill's first stage: analysis for the reference-video skill, production for a
        // production-only skill (原创创作 has nothing to study first). Starting anywhere else is the old stage-order error.
        String stage=req.stage();
        var loaded=loadPlan(userId,projectId,req.planRunId(),req.planFingerprint(),null);
        if(!stage.equals(loaded.rules().firstStage())||!stage.equals(loaded.plan().path("stage").asText()))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请先开始分析，再在同一次制作里确认制作阶段");
        skills.requireActive(loaded.rules().key());
        if("production".equals(stage)&&(req.approachId()==null||!req.approachId().equals(loaded.plan().path("recommendedApproachId").asText(""))))
            throw stale("确认的方案与当前计划不一致，请按所选方案重新生成计划后再确认");
        Confirmation confirmation=confirm(userId,projectId,req,billing,quotedTotal(loaded),byMessage);
        String confirmedThread=confirmation.threadId();
        if(req.approachId()!=null&&!approachIds(loaded.plan()).contains(req.approachId()))throw stale("所选方案不在这份计划里，请刷新后再确认");
        long quoted=requireWithinBudget(loaded,req.budgetCap(),stage);
        String id="PEX-"+UUID.randomUUID().toString().replace("-","").substring(0,20);
        Instant now=Instant.now();
        ObjectNode state=mapper.createObjectNode();
        // The confirmed rules (with the method text) drive every later planning and check run of this execution.
        state.set("skill",StudioSkillRules.snapshot(loaded.rules()));
        ArrayNode canvas=state.putArray("canvasContextIds");
        loaded.contextNodeIds().forEach(canvas::add);
        ArrayNode steps=state.putArray("steps");
        appendSteps(steps,loaded,stage);
        ObjectNode budget=mapper.createObjectNode();
        ObjectNode first=stageBudget(req,fingerprint,loaded,confirmation.card().cardPlanRevision(),quoted,now);
        if("production".equals(stage))first.put("approachId",req.approachId());
        budget.set(stage,first);
        String threadId=confirmedThread!=null?confirmedThread:loaded.threadId();
        var row=IpPlanExecution.builder().id(id).projectId(projectId).ownerUserId(userId).threadId(threadId)
                .skillKey(loaded.rules().key()).skillVersion(loaded.rules().version()).stage(stage)
                .planRunId(loaded.planRunId()).planRevision(confirmation.card().cardPlanRevision()).planFingerprint(req.planFingerprint())
                .status(IpPlanExecution.RUNNING).stepsJson(write(state)).budgetJson(write(budget)).billingJson(write(billingSnapshot(userId,billing,now)))
                .clientRequestId(req.clientRequestId()).startedAt(now).deadlineAt(now.plus(StudioPlanExecutor.WINDOW))
                .createdAt(now).updatedAt(now).build();
        executions.saveAndFlush(row);
        markApproved(userId,projectId,confirmation,id,stage,req,now);
        wakeAfterCommit(id);
        return toDto(row);
    }

    private PlanExecution confirmStage(String userId,String projectId,PlanExecutionCreateRequest req,String fingerprint,BillingSelection billing,boolean byMessage) {
        var e=lockOwned(userId,projectId,req.executionId());
        ObjectNode budget=PlanState.parse(mapper,e.getBudgetJson());
        JsonNode entry=budget.path(req.stage());
        // Replays of this exact confirmation are idempotent; the same id with a different body is refused.
        if(entry.isObject()&&req.clientRequestId().equals(entry.path("clientRequestId").asText())) {
            if(!fingerprint.equals(entry.path("requestFingerprint").asText()))throw changed();
            return toDto(e);
        }
        JsonNode fixed=PlanState.parse(mapper,e.getBillingJson());
        if(!fixed.path("mode").asText().equals(billing.mode())||!Objects.equals(fixed.path("enterpriseId").asText(null),billing.enterpriseId()))
            throw new BusinessException(HttpStatus.CONFLICT,"BILLING_SELECTION_CONFLICT","付款账户与这次制作已确认的不一致；要换付款人，请结束这次制作后重新开始");
        if(!IpPlanExecution.active(e.getStatus()))throw stale("这次制作已结束，请重新开始");
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        Instant now=Instant.now();
        if(req.stage().equals(e.getStage())) {
            // Same stage, another plan: the user changed course mid-stage (steering → revised plan → its card).
            if(!req.planRunId().equals(e.getPlanRunId())||!req.planFingerprint().equals(e.getPlanFingerprint()))
                return replanStage(userId,projectId,e,req,fingerprint,billing,byMessage,state,budget,now);
            // Same plan: only the approved cap moves (e.g. after a shortfall).
            ObjectNode current=(ObjectNode)budget.path(req.stage());
            long committed=current.path("spent").asLong()+current.path("inFlight").asLong();
            if(req.budgetCap()<committed)throw BusinessException.badRequest("STUDIO_INPUT_INVALID","上限不能低于已花费和在途的 "+committed+" 积分");
            Confirmation raise=confirm(userId,projectId,req,billing,null,byMessage);
            if(raise.threadId()!=null&&e.getThreadId()!=null&&!raise.threadId().equals(e.getThreadId()))throw stale("这条确认来自另一段对话");
            current.put("approvedCap",req.budgetCap()).put("autoFixCap",req.autoFixCap()).put("clientRequestId",req.clientRequestId())
                    .put("requestFingerprint",fingerprint).put("confirmedAt",now.toString()).remove("shortfall");
            current.put("confirmationMessageId",req.confirmationMessageId()).put("approvalId",req.approvalId());
            resumeAfterRaise(e,state,now);
            markSteeringSeen(e,state);
            e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(now);bumpLease(e);
            executions.save(e);
            markApproved(userId,projectId,raise,e.getId(),e.getStage(),req,now);
            wakeAfterCommit(e.getId());
            return toDto(e);
        }
        if(!"production".equals(req.stage())||!"analysis".equals(e.getStage()))throw stale("阶段顺序不对：先完成分析，再确认制作");
        for(JsonNode step:PlanState.stageSteps(state,"analysis"))
            if(!Set.of("done","skipped").contains(step.path("status").asText()))throw stale("分析还没有完成，完成后再确认制作方案");
        if(req.expectedRevision()==null)throw stale("请看最新的计划后再确认");
        var loaded=loadPlan(userId,projectId,req.planRunId(),req.planFingerprint(),"production");
        if(!loaded.rules().key().equals(e.getSkillKey()))throw stale("制作计划与这次分析使用的制作方法不一致");
        skills.requireActive(loaded.rules().key());
        String recommended=loaded.plan().path("recommendedApproachId").asText("");
        if(req.approachId()==null||!req.approachId().equals(recommended))
            throw stale("确认的方案与当前计划不一致，请按所选方案重新生成计划后再确认");
        Confirmation confirmation=confirm(userId,projectId,req,billing,quotedTotal(loaded),byMessage);
        String confirmedThread=confirmation.threadId();
        if(confirmedThread!=null&&e.getThreadId()!=null&&!confirmedThread.equals(e.getThreadId()))throw stale("这条确认来自另一段对话");
        long quoted=requireWithinBudget(loaded,req.budgetCap(),"production");
        appendSteps((ArrayNode)state.withArray("steps"),loaded,"production");
        state.remove("needsUserReason");
        markSteeringSeen(e,state);
        ObjectNode production=stageBudget(req,fingerprint,loaded,confirmation.card().cardPlanRevision(),quoted,now);
        production.put("approachId",req.approachId());
        budget.set("production",production);
        e.setStage("production");e.setPlanRunId(loaded.planRunId());e.setPlanRevision(confirmation.card().cardPlanRevision());
        if(e.getThreadId()==null)e.setThreadId(confirmedThread!=null?confirmedThread:loaded.threadId());
        e.setPlanFingerprint(req.planFingerprint());e.setStatus(IpPlanExecution.RUNNING);
        // Each confirmed stage gets its own 90-minute autonomous window; time waiting for the user does not count.
        e.setDeadlineAt(now.plus(StudioPlanExecutor.WINDOW));e.setSpent(0);e.setInFlight(e.getInFlight());
        e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(now);bumpLease(e);
        executions.save(e);
        markApproved(userId,projectId,confirmation,e.getId(),"production",req,now);
        wakeAfterCommit(e.getId());
        return toDto(e);
    }

    /**
     * The executor's raise card says 「确认把上限提高到 X 积分后，我接着做」: the steps it stopped for want of budget go back to
     * pending and a waiting execution runs again. Anything else that still needs the user (a failed step, an unresolved
     * check, a step that asks for confirmation) stops it again at the next advance; a user's own pause stays a pause.
     */
    private void resumeAfterRaise(IpPlanExecution e,ObjectNode state,Instant now) {
        boolean released=false;
        for(JsonNode raw:PlanState.stageSteps(state,e.getStage())) {
            ObjectNode step=(ObjectNode)raw;
            if(!"needs_user".equals(step.path("status").asText()))continue;
            // budgetBlocked is set by the executor; the reason prefix covers steps it stopped before the flag existed.
            if(!step.path("budgetBlocked").asBoolean(false)&&!step.path("reason").asText("").startsWith("本阶段预算还差"))continue;
            step.put("status","pending");step.remove("reason");step.remove("budgetBlocked");
            released=true;
        }
        if(!released||!IpPlanExecution.NEEDS_USER.equals(e.getStatus()))return;
        e.setStatus(IpPlanExecution.RUNNING);state.remove("needsUserReason");
        if(e.getDeadlineAt()==null||now.isAfter(e.getDeadlineAt()))e.setDeadlineAt(now.plus(StudioPlanExecutor.WINDOW));
    }

    /**
     * The user changed course mid-stage (D03: 「第 3 段换个人物」 → the dialogue proposed a revised plan for the same stage →
     * the user confirmed its card): the confirmed plan replaces the stage's remaining work on the same execution, the payer
     * and the stage stay. Steps the revision keeps unchanged (same id, same definition) keep their results; a changed one
     * — or one downstream of a changed one — is redone as a new attempt, its earlier runs kept for the record and the
     * budget; a step the revision drops stays only if it already ran. Work already handed to a provider is never
     * rewritten: changing a step that is still generating is refused until it ends. The new cap must cover what is spent
     * and in flight plus every step still to run.
     */
    private PlanExecution replanStage(String userId,String projectId,IpPlanExecution e,PlanExecutionCreateRequest req,String fingerprint,
            BillingSelection billing,boolean byMessage,ObjectNode state,ObjectNode budget,Instant now) {
        String stage=e.getStage();
        if(req.expectedRevision()==null)throw stale("请看最新的计划后再确认");
        var loaded=loadPlan(userId,projectId,req.planRunId(),req.planFingerprint(),stage);
        if(!loaded.rules().key().equals(e.getSkillKey()))throw stale("新方案与这次制作使用的制作方法不一致，请结束这次制作后重新开始");
        skills.requireActive(loaded.rules().key());
        if("production".equals(stage)&&(req.approachId()==null||!req.approachId().equals(loaded.plan().path("recommendedApproachId").asText(""))))
            throw stale("确认的方案与当前计划不一致，请按所选方案重新生成计划后再确认");
        Confirmation confirmation=confirm(userId,projectId,req,billing,quotedTotal(loaded),byMessage);
        if(confirmation.threadId()!=null&&e.getThreadId()!=null&&!confirmation.threadId().equals(e.getThreadId()))throw stale("这条确认来自另一段对话");

        Map<String,ObjectNode> prior=new LinkedHashMap<>();
        for(JsonNode raw:PlanState.stageSteps(state,stage))prior.put(raw.path("id").asText(),(ObjectNode)raw);
        // Which steps of the revision must run again: changed or new ones, then everything downstream of them.
        Map<String,JsonNode> definitions=new LinkedHashMap<>();
        for(JsonNode definition:loaded.plan().path("steps"))
            if(definitions.put(definition.path("id").asText(),definition)!=null)throw stale("计划里有重复的步骤");
        Set<String> redo=new HashSet<>();
        for(var entry:definitions.entrySet()) {
            ObjectNode old=prior.get(entry.getKey());
            if(old==null||!keepsResult(old)||!sameDefinition(old.path("definition"),entry.getValue()))redo.add(entry.getKey());
        }
        for(boolean grew=true;grew;) {
            grew=false;
            for(var entry:definitions.entrySet()) {
                if(redo.contains(entry.getKey()))continue;
                for(JsonNode dependency:entry.getValue().path("dependsOn"))
                    if(redo.contains(dependency.asText())){redo.add(entry.getKey());grew=true;break;}
            }
        }
        ArrayNode next=mapper.createArrayNode();
        for(JsonNode raw:state.path("steps"))if(!stage.equals(raw.path("stage").asText()))next.add(raw);
        long toRun=0;
        for(var entry:definitions.entrySet()) {
            ObjectNode old=prior.remove(entry.getKey());
            if(!redo.contains(entry.getKey())){next.add(old);continue;}
            if(old!=null&&Set.of("submitted","running").contains(old.path("status").asText()))
                throw stale("「"+old.path("title").asText()+"」还在生成中，新方案要改它，等它做完后再确认");
            ObjectNode step=newStep(entry.getValue(),loaded,stage);
            if(old!=null&&ran(old)) {
                // A new attempt: a new request identity; the earlier runs stay counted in the stage budget.
                step.put("attempt",old.path("attempt").asInt(1)+1);
                ArrayNode previous=step.putArray("previousRunIds");
                old.path("previousRunIds").forEach(previous::add);old.path("runIds").forEach(previous::add);
            } else if(old!=null)step.put("attempt",old.path("attempt").asInt(1));
            next.add(step);
            toRun=Math.addExact(toRun,step.path("quotedCost").asLong());
        }
        // Steps the revision no longer has: ones that ran stay (their results and charges are real), the rest go.
        for(ObjectNode old:prior.values()) {
            if(!ran(old)&&!Set.of("submitted","running").contains(old.path("status").asText()))continue;
            if(Set.of("pending","needs_user","failed").contains(old.path("status").asText()))old.put("status","skipped").put("reason","新方案里没有这一步");
            next.add(old);
        }
        ObjectNode current=(ObjectNode)budget.path(stage);
        long spent=current.path("spent").asLong(),inFlight=current.path("inFlight").asLong();
        if(req.budgetCap()<Math.addExact(Math.addExact(spent,inFlight),toRun))throw budgetExceeded(stage,spent,inFlight,toRun,req.budgetCap());
        state.set("steps",next);
        state.remove("needsUserReason");
        markSteeringSeen(e,state);
        current.put("approvedCap",req.budgetCap()).put("autoFixCap",req.autoFixCap()).put("quoted",quotedTotal(loaded))
                .put("planRunId",loaded.planRunId()).put("planFingerprint",req.planFingerprint()).put("planRevision",confirmation.card().cardPlanRevision())
                .put("clientRequestId",req.clientRequestId()).put("requestFingerprint",fingerprint).put("confirmedAt",now.toString())
                .put("confirmationMessageId",req.confirmationMessageId()).put("approvalId",req.approvalId()).remove("shortfall");
        if(req.approachId()!=null)current.put("approachId",req.approachId());
        e.setPlanRunId(loaded.planRunId());e.setPlanRevision(confirmation.card().cardPlanRevision());e.setPlanFingerprint(req.planFingerprint());
        e.setStatus(IpPlanExecution.RUNNING);e.setDeadlineAt(now.plus(StudioPlanExecutor.WINDOW));
        e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(now);bumpLease(e);
        executions.save(e);
        markApproved(userId,projectId,confirmation,e.getId(),stage,req,now);
        wakeAfterCommit(e.getId());
        return toDto(e);
    }
    /**
     * A step whose result a revision can keep: it finished, or it is still generating (then it has to stay unchanged). A
     * skipped step (dropped by an earlier revision) runs again when a later revision brings it back.
     */
    private static boolean keepsResult(JsonNode step) {
        return Set.of("done","submitted","running").contains(step.path("status").asText());
    }
    private static boolean ran(JsonNode step) {
        return step.path("runIds").size()>0||step.path("previousRunIds").size()>0;
    }
    /** Same step content; the server quote may move with prices and does not make it a different step. */
    private static boolean sameDefinition(JsonNode before,JsonNode after) {
        if(!before.isObject()||!after.isObject())return false;
        ObjectNode a=((ObjectNode)before).deepCopy(),b=((ObjectNode)after).deepCopy();
        a.remove("quotedCost");b.remove("quotedCost");
        return a.equals(b);
    }

    // ── Read / controls ─────────────────────────────────────────────────────────────────────────────────────────
    @Transactional(readOnly=true)
    public PlanExecution read(String userId,String projectId,String executionId) {
        projects.required(userId,projectId);
        return toDto(executions.findById(executionId).filter(e->userId.equals(e.getOwnerUserId())&&projectId.equals(e.getProjectId())).orElseThrow(StudioPlanExecutionService::notFound));
    }

    /** The project's active execution (running / paused / needs_user), if any; for the dialogue snapshot. */
    @Transactional(readOnly=true)
    public Optional<PlanExecution> active(String userId,String projectId) {
        return executions.findByProjectIdAndStatusIn(projectId,ACTIVE).stream().filter(e->userId.equals(e.getOwnerUserId())).findFirst().map(this::toDto);
    }

    @Transactional
    public PlanExecution pause(String userId,String projectId,String executionId,PlanExecutionControlRequest req) {
        return control(userId,projectId,executionId,req,"pause");
    }
    @Transactional
    public PlanExecution resume(String userId,String projectId,String executionId,PlanExecutionControlRequest req) {
        return control(userId,projectId,executionId,req,"resume");
    }
    @Transactional
    public PlanExecution cancel(String userId,String projectId,String executionId,PlanExecutionControlRequest req) {
        return control(userId,projectId,executionId,req,"cancel");
    }

    /**
     * Priority control entry for the dialogue side (stop / pause / resume) without a project id; {@code stop} cancels.
     * Same idempotency and preemption as the REST controls.
     */
    @Transactional
    public PlanExecution control(String userId,String executionId,String action,String controlId) {
        var e=executions.findById(executionId).filter(x->userId.equals(x.getOwnerUserId())).orElseThrow(StudioPlanExecutionService::notFound);
        String mapped="stop".equals(action)?"cancel":action;
        if(!Set.of("pause","resume","cancel").contains(mapped))throw BusinessException.badRequest("STUDIO_INPUT_INVALID","不支持的操作");
        return control(userId,e.getProjectId(),executionId,new PlanExecutionControlRequest(controlId,null),mapped);
    }

    private PlanExecution control(String userId,String projectId,String executionId,PlanExecutionControlRequest req,String action) {
        if(req==null||req.clientRequestId()==null||req.clientRequestId().isBlank()||req.clientRequestId().length()>64)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请求编号无效");
        projects.required(userId,projectId);
        var e=lockOwned(userId,projectId,executionId);
        ObjectNode budget=PlanState.parse(mapper,e.getBudgetJson());
        if(replayed(budget,req.clientRequestId(),action,null))return toDto(e);
        if(req.expectedStatus()!=null&&!req.expectedStatus().equals(e.getStatus()))throw stale("这次制作的状态已经变化，请刷新后再操作");
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        Instant now=Instant.now();
        switch(action) {
            case "pause" -> {
                if(IpPlanExecution.PAUSED.equals(e.getStatus()))break;
                if(!Set.of(IpPlanExecution.RUNNING,IpPlanExecution.NEEDS_USER).contains(e.getStatus()))throw stale("这次制作已结束，不能暂停");
                e.setStatus(IpPlanExecution.PAUSED);state.put("needsUserReason","已暂停：不会再提交新的步骤，已受理的任务会继续完成和结算。");
            }
            case "cancel" -> {
                if(IpPlanExecution.CANCELED.equals(e.getStatus()))break;
                if(!IpPlanExecution.active(e.getStatus()))throw stale("这次制作已结束");
                e.setStatus(IpPlanExecution.CANCELED);e.setFinishedAt(now);unbindThreadAfterCommit(e.getThreadId());
                state.put("needsUserReason","已停止：不会再提交新的步骤；还在排队的任务会取消，已交给生成引擎的任务按原链完成和结算。");
            }
            case "resume" -> {
                if(IpPlanExecution.RUNNING.equals(e.getStatus()))break;
                if(!Set.of(IpPlanExecution.PAUSED,IpPlanExecution.NEEDS_USER).contains(e.getStatus()))throw stale("这次制作已结束，不能继续");
                if("analysis".equals(e.getStage())&&stageFinished(state,"analysis"))throw stale("分析已经完成，请确认制作方案和预算后开始制作");
                skills.requireActive(e.getSkillKey());
                ObjectNode next=state.deepCopy();
                for(JsonNode raw:PlanState.stageSteps(next,e.getStage())) {
                    ObjectNode step=(ObjectNode)raw;
                    switch(step.path("status").asText()) {
                        case "needs_user" -> {step.put("status","pending").put("confirmed",true);step.remove("reason");}
                        // Only the user's explicit continue starts a new attempt (new request identity).
                        case "failed" -> {step.put("status","pending").put("attempt",step.path("attempt").asInt(1)+1);step.remove("reason");step.remove("errorCode");}
                        default -> {if(PlanState.unresolvedCheck(next,step))step.put("acknowledged",true);}
                    }
                }
                // No budget pre-check here: a next step that does not fit is stopped by the executor, which posts the
                // 「追加预算」 card the user can confirm. Refusing with 402 here left no card at all — after steering had
                // used the last credits, 「继续」 was a dead end (Codex retest 2026-10-19, R3).
                markSteeringSeen(e,next); // the explicit continue supersedes messages sent before it
                state=next;
                e.setStatus(IpPlanExecution.RUNNING);state.remove("needsUserReason");
                if(e.getDeadlineAt()==null||now.isAfter(e.getDeadlineAt()))e.setDeadlineAt(now.plus(StudioPlanExecutor.WINDOW));
            }
            default -> throw new IllegalArgumentException(action);
        }
        remember(budget,req.clientRequestId(),action,null);
        e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(now);bumpLease(e);
        executions.save(e);
        wakeAfterCommit(e.getId());
        return toDto(e);
    }

    /** The user adopts a successful run / candidate of a step. Records the judgment; never rewrites an AI verdict. */
    @Transactional
    public PlanExecution accept(String userId,String projectId,String executionId,String stepId,PlanExecutionAcceptRequest req) {
        if(req==null||req.clientRequestId()==null||req.clientRequestId().isBlank()||req.clientRequestId().length()>64||req.runId()==null||req.runId().isBlank())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请选择要采用的结果");
        projects.required(userId,projectId);
        var e=lockOwned(userId,projectId,executionId);
        ObjectNode budget=PlanState.parse(mapper,e.getBudgetJson());
        String detail=stepId+"|"+req.runId()+"|"+req.candidateIndex();
        if(replayed(budget,req.clientRequestId(),"accept",detail))return toDto(e);
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        ObjectNode step=PlanState.stepForUser(state,e.getStage(),stepId);
        if(step==null)throw BusinessException.badRequest("STUDIO_INPUT_INVALID","这一步不存在");
        boolean own=false;for(JsonNode id:step.path("runIds"))own|=req.runId().equals(id.asText());
        if(!own)throw BusinessException.badRequest("STUDIO_INPUT_INVALID","只能采用这一步自己生成的结果");
        var dto=outputs.run(userId,projectId,req.runId()).orElseThrow(()->BusinessException.badRequest("STUDIO_INPUT_INVALID","这次生成不存在"));
        if(!"done".equals(dto.status()))throw stale("这次生成还没有成功，不能采用");
        if(req.candidateIndex()!=null&&(req.candidateIndex()<0||outputs.outputKey(dto,req.candidateIndex())==null))
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","所选候选没有可用结果");
        step.put("acceptedRunId",req.runId());
        if(req.candidateIndex()!=null)step.put("acceptedCandidateIndex",req.candidateIndex());else step.remove("acceptedCandidateIndex");
        step.put("acceptedAt",Instant.now().toString());
        remember(budget,req.clientRequestId(),"accept",detail);
        e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(Instant.now());bumpLease(e);
        executions.save(e);
        wakeAfterCommit(e.getId());
        return toDto(e);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────
    record Confirmation(StudioDialogueApprovals.Card card) {
        String threadId(){return card.threadId();}
    }

    private StudioDialogueApprovals cards() {
        var cards=approvals==null?null:approvals.getIfAvailable();
        if(cards==null)throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"STUDIO_EXECUTION_UNAVAILABLE","对话确认服务暂不可用，请稍后再试");
        return cards;
    }

    /**
     * Bind the user's confirmation to exactly this plan (D01 / D02): the approval card the dialogue showed, located by the
     * clicked card's message (button) or by the user's approving message (words). The card must be pending and quote the
     * thread's current plan revision; the request must name that same plan, revision, stage, quote and payer. There is no
     * path without a card.
     */
    private Confirmation confirm(String userId,String projectId,PlanExecutionCreateRequest req,BillingSelection billing,Long quoted,boolean byMessage) {
        var cards=cards();
        var card=byMessage?cards.requireApprovalByMessage(userId,projectId,req.confirmationMessageId(),req.approvalId())
                :cards.requireApproval(userId,projectId,req.confirmationMessageId(),req.approvalId());
        if(!card.planFingerprint().equals(card.currentPlanFingerprint()))throw stale("方案已经更新到新的一版，请看最新的方案后再确认");
        if(!req.planFingerprint().equals(card.planFingerprint()))throw stale("这张确认卡对应的不是当前这份方案，请看最新的方案后再确认");
        if(card.cardPlanRunId()!=null&&!card.cardPlanRunId().equals(req.planRunId()))throw stale("这张确认卡对应的是另一份计划，请刷新后再确认");
        if(req.expectedRevision()!=null&&req.expectedRevision()!=card.currentPlanRevision())throw stale("计划已经更新，请看最新的计划后再确认");
        if(!req.stage().equals(card.stage()))throw stale("这张确认卡属于另一个阶段");
        JsonNode block=card.block();
        if(quoted!=null&&block.hasNonNull("quotedCost")&&block.path("quotedCost").asLong()!=quoted)throw stale("报价已经变化，请看最新的报价后再确认");
        if(block.hasNonNull("billingSelection")) {
            var shown=EnterpriseBillingService.normalize(mapper.convertValue(block.path("billingSelection"),BillingSelection.class));
            if(!shown.equals(billing))throw new BusinessException(HttpStatus.CONFLICT,"BILLING_SELECTION_CONFLICT","付款账户与确认卡上的不一致，请重新确认");
        }
        return new Confirmation(card);
    }
    private static long quotedTotal(LoadedPlan loaded) {
        long total=0;for(JsonNode step:loaded.plan().path("steps"))total=Math.addExact(total,step.path("quotedCost").asLong());return total;
    }

    /**
     * In this transaction (thread row still locked by the card lookup): the card becomes approved with the authorization
     * snapshot the user actually gave (D10) and the thread is bound to the execution (paid tools, stop/pause forwarding).
     */
    private void markApproved(String userId,String projectId,Confirmation confirmation,String executionId,String stage,PlanExecutionCreateRequest req,Instant now) {
        cards().markApproved(userId,projectId,confirmation.card(),new StudioDialogueApprovals.Approved(executionId,stage,req.budgetCap(),req.autoFixCap(),
                req.confirmationMessageId(),confirmation.card().cardPlanRevision(),now));
    }

    /**
     * D03: steering bound to this execution that the user's newer explicit decision (a stage confirmation, a raise, a
     * resume) supersedes; the executor will not block on it again. Messages still queued get their reply turn after commit.
     */
    private void markSteeringSeen(IpPlanExecution e,ObjectNode state) {
        var source=steering==null?null:steering.getIfAvailable();
        if(source==null||e.getThreadId()==null)return;
        boolean queued=false;
        for(var note:source.notes(e.getThreadId(),e.getId())) {
            PlanState.markSteeringSeen(state,note.id());
            queued|="queued".equals(note.status());
        }
        if(queued){String thread=e.getThreadId();afterCommit(()->source.openTurn(thread),"steering reply");}
    }
    /** After commit: a terminal execution no longer occupies its thread. */
    void unbindThreadAfterCommit(String threadId) {
        var target=dialogue==null?null:dialogue.getIfAvailable();
        if(threadId==null||target==null)return;
        afterCommit(()->target.bindExecution(threadId,null,null),"thread unbinding");
    }
    private void afterCommit(Runnable action,String label) {
        Runnable safe=()->{try{action.run();}catch(RuntimeException e){log.warn("[plan-exec] {} failed after commit: {}",label,e.toString());}};
        if(TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){safe.run();}});
        else safe.run();
    }

    record LoadedPlan(String planRunId,JsonNode plan,StudioSkillRules.Rules rules,List<String> contextNodeIds,int revision,String threadId) {}

    /**
     * The plan must belong to the caller and this project and be unmodified since the server fingerprinted it: either a
     * native skill-planning run ({@code output.plan}) or a plan block a {@link StudioPlanSource} (the dialogue) returns.
     */
    /** {@code stage} null: any stage (the caller compares it); otherwise the plan must belong to that stage. */
    private LoadedPlan loadPlan(String userId,String projectId,String planRunId,String fingerprint,String expectedStage) {
        LoadedPlan loaded=nativePlan(userId,projectId,planRunId);
        // A dialogue run's output.plan is only the turn's latest plan; an earlier revision is read from its plan block.
        if(loaded!=null&&!fingerprint.equals(StudioPlanValidator.fingerprint(loaded.plan())))loaded=null;
        if(loaded==null)for(var source:sources.orderedStream().toList()) {
            var record=source.find(userId,projectId,planRunId,fingerprint).orElse(null);
            if(record==null||!planRunId.equals(record.planRunId())||record.plan()==null||!record.plan().isObject())continue;
            if(projects.ownedRun(userId,projectId,planRunId).isEmpty())continue;
            loaded=new LoadedPlan(planRunId,record.plan(),StudioSkillRules.fromSnapshot(record.skillSnapshot()),
                    record.contextNodeIds()==null?List.of():List.copyOf(record.contextNodeIds()),record.revision(),record.threadId());
            break;
        }
        if(loaded==null)throw stale("找不到这份计划，请刷新后再确认");
        JsonNode plan=loaded.plan();
        if(!StudioPlanValidator.isSkillPlan(plan))throw stale("这份计划不是可以连续执行的制作计划");
        String stage=expectedStage==null?plan.path("stage").asText():expectedStage;
        if(!StudioSkillRules.STAGES.contains(stage)||!stage.equals(plan.path("stage").asText()))throw stale("这份计划属于另一个阶段");
        String recomputed=StudioPlanValidator.fingerprint(plan);
        String stored=plan.path("fingerprint").asText(recomputed);
        if(!recomputed.equals(fingerprint)||!stored.equals(recomputed))throw stale("计划已经变化，请看最新的计划后再确认");
        if(!loaded.rules().key().equals(plan.path("skillKey").asText()))throw stale("计划与制作方法不一致");
        var allowed=new HashSet<>(loaded.rules().stageOperations(stage));
        for(JsonNode step:plan.path("steps")) {
            if(!allowed.contains(step.path("operation").asText()))
                throw BusinessException.badRequest("STUDIO_SKILL_OPERATION_NOT_ALLOWED","计划里有当前阶段不允许的操作");
            if(!step.path("quotedCost").canConvertToLong())throw stale("计划还没有服务端报价，暂时不能确认");
        }
        return loaded;
    }
    private LoadedPlan nativePlan(String userId,String projectId,String planRunId) {
        var run=projects.ownedRun(userId,projectId,planRunId).orElse(null);
        // A native skill-planning run, or the dialogue parent run whose output.plan is the turn's latest plan.
        if(run==null||!Set.of("studio-text","studio-dialogue").contains(run.getKind()))return null;
        JsonNode plan=PlanState.parse(mapper,run.getOutputJson()).path("plan");
        if(!plan.isObject())return null;
        if(!IpRun.STATUS_DONE.equals(run.getStatus()))throw stale("这份计划还没有生成完成");
        JsonNode input=PlanState.parse(mapper,run.getInputJson());
        List<String> context=new ArrayList<>();input.path("contextNodeIds").forEach(v->context.add(v.asText()));
        return new LoadedPlan(run.getId(),plan,StudioSkillRules.fromSnapshot(input.path("_exec").path("skill")),context,
                plan.path("revision").asInt(1),input.path("dialogue").path("threadId").asText(null));
    }

    private long requireWithinBudget(LoadedPlan loaded,long cap,String stage) {
        long quoted=0;
        for(JsonNode step:loaded.plan().path("steps"))quoted=Math.addExact(quoted,step.path("quotedCost").asLong());
        if(quoted>cap)throw budgetExceeded(stage,0,0,quoted,cap);
        return quoted;
    }

    static BusinessException budgetExceeded(String stage,long spent,long inFlight,long quoted,long cap) {
        long shortfall=spent+inFlight+quoted-cap;
        var details=new ObjectMapper().createObjectNode().put("stage",stage).put("spent",spent).put("inFlight",inFlight)
                .put("quotedCost",quoted).put("approvedCap",cap).put("shortfall",shortfall);
        return new BusinessException(HttpStatus.PAYMENT_REQUIRED,"STUDIO_PLAN_BUDGET_EXCEEDED","预算不够，还差 "+shortfall+" 积分。可以追加预算或缩小计划后再继续",details);
    }

    private void appendSteps(ArrayNode steps,LoadedPlan loaded,String stage) {
        Set<String> seen=new HashSet<>();
        for(JsonNode existing:steps)if(stage.equals(existing.path("stage").asText()))seen.add(existing.path("id").asText());
        for(JsonNode definition:loaded.plan().path("steps")) {
            if(!seen.add(definition.path("id").asText()))throw stale("计划里有重复的步骤");
            steps.add(newStep(definition,loaded,stage));
        }
    }
    private ObjectNode newStep(JsonNode definition,LoadedPlan loaded,String stage) {
        var step=mapper.createObjectNode().put("id",definition.path("id").asText()).put("stage",stage).put("title",definition.path("title").asText())
                .put("operation",definition.path("operation").asText()).put("execution",definition.path("execution").asText("auto"))
                .put("status","pending").put("attempt",1).put("quotedCost",definition.path("quotedCost").asLong())
                .put("maxCost",definition.path("quotedCost").asLong()).put("planRunId",loaded.planRunId());
        step.set("dependsOn",definition.path("dependsOn").isArray()?definition.path("dependsOn").deepCopy():mapper.createArrayNode());
        step.putArray("runIds");
        step.set("definition",definition.deepCopy());
        return step;
    }

    private ObjectNode stageBudget(PlanExecutionCreateRequest req,String fingerprint,LoadedPlan loaded,int revision,long quoted,Instant now) {
        var out=mapper.createObjectNode().put("approvedCap",req.budgetCap()).put("autoFixCap",req.autoFixCap()).put("quoted",quoted)
                .put("spent",0).put("inFlight",0).put("planRunId",loaded.planRunId()).put("planFingerprint",req.planFingerprint())
                .put("planRevision",revision).put("clientRequestId",req.clientRequestId())
                .put("requestFingerprint",fingerprint).put("confirmedAt",now.toString());
        if(req.approvalId()!=null)out.put("approvalId",req.approvalId());
        if(req.confirmationMessageId()!=null)out.put("confirmationMessageId",req.confirmationMessageId());
        if(req.approachId()!=null)out.put("approachId",req.approachId());
        return out;
    }

    /** Immutable payer binding: mode, enterprise and the member relation verified now (never trusted from the client). */
    private ObjectNode billingSnapshot(String userId,BillingSelection billing,Instant now) {
        var out=mapper.createObjectNode().put("mode",billing.mode()).put("boundAt",now.toString());
        if(billing.enterpriseId()!=null) {
            out.put("enterpriseId",billing.enterpriseId());
            if(enterpriseAccess!=null)out.put("membershipId",enterpriseAccess.member(userId,billing.enterpriseId()).getId());
        }
        return out;
    }

    private void validate(PlanExecutionCreateRequest req) {
        if(req==null||req.clientRequestId()==null||!REQUEST_ID.matcher(req.clientRequestId()).matches())throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请求编号无效");
        if(!StudioSkillRules.STAGES.contains(req.stage()))throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请选择分析或制作阶段");
        for(String value:Arrays.asList(req.planRunId(),req.planFingerprint()))
            if(value==null||value.isBlank()||value.length()>64)throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请选择要执行的计划");
        if(req.budgetCap()==null||req.budgetCap()<0||req.autoFixCap()==null||req.autoFixCap()<0||req.autoFixCap()>req.budgetCap())
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请确认本阶段的预算上限");
        for(String value:Arrays.asList(req.executionId(),req.approachId(),req.approvalId(),req.confirmationMessageId()))
            if(value!=null&&(value.isBlank()||value.length()>64))throw BusinessException.badRequest("STUDIO_INPUT_INVALID","确认信息不完整");
        // D02: every stage confirmation and every raise needs the card the user confirmed; there is no implicit path.
        if(req.approvalId()==null||req.confirmationMessageId()==null)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请在对话里的确认卡上确认方案和预算后再开始");
    }

    private IpPlanExecution lockOwned(String userId,String projectId,String executionId) {
        var e=executions.lockById(executionId).orElseThrow(StudioPlanExecutionService::notFound);
        if(!userId.equals(e.getOwnerUserId())||!projectId.equals(e.getProjectId()))throw notFound();
        return e;
    }
    /** Preempt any running advance: its next write re-checks the version and stops. */
    private static void bumpLease(IpPlanExecution e) {e.setLeaseVersion(e.getLeaseVersion()+1);e.setLeaseOwner(null);e.setLeaseUntil(null);}

    private boolean replayed(ObjectNode budget,String requestId,String action,String detail) {
        JsonNode seen=budget.path("requests").path(requestId);
        if(seen.isMissingNode())return false;
        if(!action.equals(seen.path("action").asText())||!Objects.equals(detail,seen.path("detail").asText(null)))throw changed();
        return true;
    }
    private void remember(ObjectNode budget,String requestId,String action,String detail) {
        var entry=budget.withObject("/requests").putObject(requestId).put("action",action).put("at",Instant.now().toString());
        if(detail!=null)entry.put("detail",detail);
    }
    private static boolean stageFinished(JsonNode state,String stage) {
        for(JsonNode step:PlanState.stageSteps(state,stage))if(!Set.of("done","skipped").contains(step.path("status").asText()))return false;
        return true;
    }
    private static Set<String> approachIds(JsonNode plan) {
        Set<String> out=new HashSet<>();plan.path("approaches").forEach(a->out.add(a.path("id").asText()));return out;
    }

    private void wakeAfterCommit(String id) {
        Runnable wake=()->{
            try {var target=executor.getIfAvailable();if(target!=null)target.wake(id);}
            catch(RuntimeException e){log.warn("[plan-exec] wake deferred to the scheduler id={} reason={}",id,e.toString());}
        };
        if(TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){wake.run();}});
        else wake.run();
    }

    PlanExecution toDto(IpPlanExecution e) {
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson()),budget=PlanState.parse(mapper,e.getBudgetJson());
        List<PlanExecutionStep> steps=new ArrayList<>();
        for(JsonNode step:state.path("steps")) {
            List<String> depends=new ArrayList<>(),runIds=new ArrayList<>();
            step.path("dependsOn").forEach(v->depends.add(v.asText()));step.path("runIds").forEach(v->runIds.add(v.asText()));
            steps.add(new PlanExecutionStep(step.path("id").asText(),step.path("title").asText(),step.path("operation").asText(),step.path("stage").asText(),
                    depends,step.path("status").asText(),runIds,step.path("attempt").asInt(1),step.path("quotedCost").asLong(),
                    step.hasNonNull("maxCost")?step.path("maxCost").asLong():null,step.path("acceptedRunId").asText(null),
                    step.hasNonNull("acceptedCandidateIndex")?step.path("acceptedCandidateIndex").asInt():null,
                    StudioPlanExecutionIds.nodeId(e.getId(),step.path("stage").asText(),step.path("id").asText()),step.path("reason").asText(null)));
        }
        List<PlanExecutionBudget> budgets=new ArrayList<>();
        for(String stage:List.of("analysis","production")) {
            JsonNode b=budget.path(stage);
            if(!b.isObject())continue;
            long cap=b.path("approvedCap").asLong(),spent=b.path("spent").asLong(),inFlight=b.path("inFlight").asLong();
            budgets.add(new PlanExecutionBudget(stage,cap,b.path("autoFixCap").asLong(),spent,inFlight,Math.max(0,cap-spent-inFlight),
                    b.hasNonNull("shortfall")?b.path("shortfall").asLong():null,
                    b.hasNonNull("dialogueSpent")?b.path("dialogueSpent").asLong():null,b.hasNonNull("dialogueInFlight")?b.path("dialogueInFlight").asLong():null));
        }
        JsonNode billing=PlanState.parse(mapper,e.getBillingJson());
        var selection=new BillingSelection(billing.path("mode").asText("personal"),billing.path("enterpriseId").asText(null));
        return new PlanExecution(e.getId(),e.getProjectId(),e.getThreadId(),e.getSkillKey(),e.getSkillVersion(),e.getStage(),e.getPlanRunId(),
                e.getPlanRevision(),e.getPlanFingerprint(),e.getStatus(),steps,budgets,selection,state.path("needsUserReason").asText(null),
                iso(e.getStartedAt()),iso(e.getDeadlineAt()),iso(e.getUpdatedAt()),iso(e.getFinishedAt()));
    }
    private static String iso(Instant t){return t==null?null:t.toString();}

    private JsonNode canonical(JsonNode node) {
        if(node.isObject()) {
            ObjectNode out=mapper.createObjectNode();
            new TreeMap<String,JsonNode>(){{node.fields().forEachRemaining(e->{if(!e.getValue().isNull())put(e.getKey(),e.getValue());});}}.forEach((k,v)->out.set(k,canonical(v)));
            return out;
        }
        if(node.isArray()){ArrayNode out=mapper.createArrayNode();node.forEach(v->out.add(canonical(v)));return out;}
        return node;
    }
    private String write(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    static BusinessException notFound(){return new BusinessException(HttpStatus.NOT_FOUND,"STUDIO_PLAN_EXECUTION_NOT_FOUND","这次连续制作不存在或已删除");}
    static BusinessException stale(String message){return new BusinessException(HttpStatus.CONFLICT,"STUDIO_PLAN_STALE",message);}
    static BusinessException changed(){return new BusinessException(HttpStatus.CONFLICT,"STUDIO_REQUEST_CHANGED","同一请求的内容已改变，请刷新后重新提交");}
}
