package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents;
import com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.Instant;
import java.util.Objects;

/**
 * The plan executor's side of the dialogue's paid child-run gate ({@link StudioExecutionGate}). Priority controls are
 * forwarded by the dialogue's own adapter to {@link StudioPlanExecutionService#control}.
 *
 * <p>A dialogue child run is authorized against the same stage budget formula as executor steps
 * ({@code spent + inFlight + quote ≤ approvedCap}) and registered on the execution with its approved ceiling before it is
 * submitted, so it is counted in flight even if the submit outcome is unknown. The gate never freezes anything: the
 * native run that follows does its own preflight, hold and settlement with the execution's fixed payer.
 */
@Component
public class StudioPlanExecutionBridge implements StudioExecutionGate {
    private final IpPlanExecutionRepository executions;
    private final StudioWorkflowService workflow;
    private final StudioPlanQuoter quoter;
    private final StudioSkillRules skills;
    private final IpProjectService projects;
    private final ObjectProvider<StudioDialogueEvents> events;
    private final ObjectMapper mapper;
    public StudioPlanExecutionBridge(IpPlanExecutionRepository executions,StudioWorkflowService workflow,
            StudioPlanQuoter quoter,StudioSkillRules skills,IpProjectService projects,ObjectProvider<StudioDialogueEvents> events,ObjectMapper mapper) {
        this.executions=executions;this.workflow=workflow;this.quoter=quoter;this.skills=skills;this.projects=projects;
        this.events=events;this.mapper=mapper;
    }

    // ── StudioExecutionGate ─────────────────────────────────────────────────────────────────────────────────────
    @Override
    @Transactional
    public RunRequest authorizeChild(String userId,String projectId,String executionId,String stage,RunRequest request) {
        if(request==null||request.clientRequestId()==null||request.clientRequestId().isBlank()||request.clientRequestId().length()>64)
            throw BusinessException.badRequest("STUDIO_INPUT_INVALID","请求编号无效");
        var e=executions.lockById(executionId).filter(x->userId.equals(x.getOwnerUserId())&&projectId.equals(x.getProjectId()))
                .orElseThrow(StudioPlanExecutionService::notFound);
        if(!IpPlanExecution.RUNNING.equals(e.getStatus()))throw StudioPlanExecutionService.stale("这次制作已暂停或结束，不能再提交新的任务");
        String current=stage==null?e.getStage():stage;
        if(!current.equals(e.getStage()))throw StudioPlanExecutionService.stale("这次制作已经进入另一个阶段，请刷新后再操作");
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        var rules=StudioSkillRules.fromSnapshot(state.path("skill"));
        skills.requireActive(rules.key());
        if(!rules.stageOperations(current).contains(request.operation()))
            throw BusinessException.badRequest("STUDIO_SKILL_OPERATION_NOT_ALLOWED","这一步的操作不在当前阶段允许的范围内");
        ObjectNode budget=PlanState.parse(mapper,e.getBudgetJson());
        JsonNode existing=PlanState.child(state,request.clientRequestId());
        long quote;
        if(existing!=null) {
            if(!request.operation().equals(existing.path("operation").asText()))throw StudioPlanExecutionService.changed();
            quote=existing.path("maxCost").asLong();
        } else {
            quote=workflow.quote(userId,request);
            ObjectNode stageBudget=(ObjectNode)budget.path(current);
            long spent=stageBudget.path("spent").asLong(),inFlight=stageBudget.path("inFlight").asLong(),cap=stageBudget.path("approvedCap").asLong();
            if(spent+inFlight+quote>cap) {
                long shortfall=spent+inFlight+quote-cap;
                publishAfterCommit(e,"budget.update",mapper.createObjectNode().put("executionId",e.getId()).put("stage",current).put("approvedCap",cap)
                        .put("spent",spent).put("inFlight",inFlight).put("remaining",Math.max(0,cap-spent-inFlight)).put("shortfall",shortfall).put("source","quote"));
                throw StudioPlanExecutionService.budgetExceeded(current,spent,inFlight,quote,cap);
            }
            state.withArray("children").addObject().put("clientRequestId",request.clientRequestId()).put("operation",request.operation())
                    .put("stage",current).put("nodeId",request.nodeId()).put("maxCost",quote).put("status","authorized").put("authorizedAt",Instant.now().toString());
            stageBudget.put("inFlight",inFlight+quote);
            e.setInFlight(e.getInFlight()+quote);
            e.setStepsJson(write(state));e.setBudgetJson(write(budget));e.setUpdatedAt(Instant.now());
            executions.save(e);
        }
        ObjectNode body=mapper.valueToTree(request);
        body.put("executionId",e.getId()).put("stage",current).put("maxCost",quote);
        body.set("billing",mapper.valueToTree(billing(e)));
        if(rules.key()!=null&&"check".equals(request.operation()))body.put("skillKey",rules.key()).put("skillVersion",rules.version());
        return mapper.convertValue(body,RunRequest.class);
    }

    @Override
    @Transactional
    public void childAccepted(String userId,String projectId,String executionId,String clientRequestId,String runId) {
        var e=executions.lockById(executionId).filter(x->userId.equals(x.getOwnerUserId())&&projectId.equals(x.getProjectId()))
                .orElseThrow(StudioPlanExecutionService::notFound);
        var run=projects.ownedRun(userId,projectId,runId).orElseThrow(()->BusinessException.badRequest("STUDIO_INPUT_INVALID","这次生成不存在"));
        if(!Objects.equals(clientRequestId,run.getClientRequestId()))throw BusinessException.badRequest("STUDIO_INPUT_INVALID","生成与授权的请求不一致");
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        ObjectNode child=PlanState.child(state,clientRequestId);
        if(child==null)throw BusinessException.badRequest("STUDIO_INPUT_INVALID","这次生成没有经过制作授权");
        if(runId.equals(child.path("runId").asText()))return;
        child.put("runId",runId).put("status","running");
        e.setStepsJson(write(state));e.setUpdatedAt(Instant.now());
        executions.save(e);
    }

    @Override
    public void quotePlan(String userId,String projectId,ObjectNode plan) {
        projects.required(userId,projectId);
        quoter.quote(userId,plan);
    }

    private com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing(IpPlanExecution e) {
        JsonNode billing=PlanState.parse(mapper,e.getBillingJson());
        return "enterprise".equals(billing.path("mode").asText())
                ?new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection("enterprise",billing.path("enterpriseId").asText())
                :new com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection("personal",null);
    }
    /** A refused authorization rolls back; the budget event describes no state change, so it is published regardless. */
    private void publishAfterCommit(IpPlanExecution e,String type,ObjectNode data) {
        var sink=events.getIfAvailable();
        if(sink==null||e.getThreadId()==null)return;
        String thread=e.getThreadId(),id=e.getId();
        Runnable send=()->{try{sink.publish(thread,id,null,id,type,data);}catch(RuntimeException ignored){/* projection only */}};
        if(TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){send.run();}});
        else send.run();
    }
    private String write(Object value){try{return mapper.writeValueAsString(value);}catch(Exception x){throw new IllegalStateException(x);}}
}
