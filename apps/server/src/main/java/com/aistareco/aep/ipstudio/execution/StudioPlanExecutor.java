package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.CheckSettings;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * The single advance entry of plan executions (docs/ip-studio-conversational-video-recreation-plan.md §服务端推进与恢复).
 *
 * <p>Startup scan, the 60 s wake-up, worker completion and user actions all call {@link #advance}. Advancing first takes
 * the lease by a conditional update; every later write re-checks owner + version under a row lock, so a worker that lost
 * the lease can neither submit nor overwrite state. Each submission uses the step's stable request id, persisted before
 * the native call: a crash, a repeated wake or an unknown outcome is resolved by looking the request up, never by
 * submitting a second task. The executor never freezes credits; holds, settlement and refunds stay in the native runs.
 */
@Service
public class StudioPlanExecutor {
    private static final Logger log=LoggerFactory.getLogger(StudioPlanExecutor.class);
    static final Duration LEASE=Duration.ofMinutes(2);
    static final Duration WINDOW=Duration.ofMinutes(90);
    static final Duration CHILD_GRACE=Duration.ofMinutes(15);
    private static final int MAX_ROUNDS=40;
    private static final List<String> TRACKED=List.of(IpPlanExecution.RUNNING,IpPlanExecution.PAUSED,IpPlanExecution.NEEDS_USER,IpPlanExecution.PARTIAL,IpPlanExecution.CANCELED);

    private final IpPlanExecutionRepository executions;
    private final IpRunRepository runRepository;
    private final StudioPlanOutputs outputs;
    private final StudioWorkflowService workflow;
    private final IpRunService runs;
    private final IpProjectService projects;
    private final StudioPlanQuoter quoter;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    private final ObjectProvider<StudioDialogueEvents> events;
    private final String instance="pex-"+UUID.randomUUID().toString().substring(0,8);
    /** Scheduled wakes run on the executor's own pool, never on the shared scheduler thread. */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    @org.springframework.beans.factory.annotation.Qualifier("studioPlanExecutionPool")
    private org.springframework.core.task.TaskExecutor pool;
    /** A terminal execution releases its dialogue thread binding (paid tools and controls stop routing to it). */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueService> dialogue;
    /** D03: user messages sent while this execution ran; read before every submission. */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering> steering;
    /** D07 / cards: messages the executor posts on its thread (summary, budget raise, compiled production plan). */
    @org.springframework.beans.factory.annotation.Autowired(required=false)
    private ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionMessages> messages;

    public StudioPlanExecutor(IpPlanExecutionRepository executions,IpRunRepository runRepository,StudioPlanOutputs outputs,
            StudioWorkflowService workflow,IpRunService runs,IpProjectService projects,StudioPlanQuoter quoter,ObjectMapper mapper,
            PlatformTransactionManager manager,ObjectProvider<StudioDialogueEvents> events) {
        this.executions=executions;this.runRepository=runRepository;this.outputs=outputs;this.workflow=workflow;this.runs=runs;
        this.projects=projects;this.quoter=quoter;this.mapper=mapper;this.events=events;
        this.tx=new TransactionTemplate(manager);this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Async("studioPlanExecutionPool")
    public void wake(String executionId) {advance(executionId);}

    /** Startup and every minute: executions whose lease expired and that are running or still tracking accepted runs. */
    @Scheduled(initialDelayString="${aep.ipstudio.plan-execution.initial-delay-ms:15000}",fixedDelayString="${aep.ipstudio.plan-execution.scan-ms:60000}")
    public void scan() {
        try {
            for(String id:executions.recoverable(TRACKED,Instant.now())) {
                Runnable task=()->{try {advance(id);} catch(RuntimeException e) {log.warn("[plan-exec] advance failed id={}",id,e);}};
                try {if(pool!=null)pool.execute(task);else task.run();}
                catch(org.springframework.core.task.TaskRejectedException full) {log.warn("[plan-exec] pool full, next scan retries id={}",id);}
            }
        } catch(RuntimeException e) {log.warn("[plan-exec] scan failed: {}",e.toString());}
    }

    /** Unified advance entry. Returns quietly when another holder owns a live lease. */
    public void advance(String executionId) {
        var row=executions.findById(executionId).orElse(null);
        if(row==null||IpPlanExecution.DONE.equals(row.getStatus())||IpPlanExecution.FAILED.equals(row.getStatus()))return;
        String owner=instance+"-"+UUID.randomUUID().toString().substring(0,12);
        Instant now=Instant.now();
        long expected=row.getLeaseVersion();
        if(executions.acquireLease(executionId,owner,expected,now,now.plus(LEASE))!=1)return;
        long version=expected+1;
        try {
            for(int round=0;round<MAX_ROUNDS;round++) {
                List<Event> pending=new ArrayList<>();
                List<Runnable> after=new ArrayList<>();
                Decision decision=tx.execute(status->decide(executionId,owner,version,pending,after));
                publish(executionId,pending);
                // Messages, the reply turn for steering and the thread unbinding, only after the state they describe committed.
                for(Runnable action:after) {
                    try {action.run();} catch(RuntimeException e) {log.warn("[plan-exec] follow-up failed execution={} reason={}",executionId,e.toString());}
                }
                if(decision!=null&&decision.unbindThread()!=null)unbind(decision.unbindThread());
                if(decision==null||decision.submission()==null)break;
                if(!submit(executionId,owner,version,decision.submission()))break;
                if(executions.renewLease(executionId,owner,version,Instant.now().plus(LEASE))!=1)break;
            }
        } finally {
            try {executions.releaseLease(executionId,owner,version);} catch(RuntimeException e){log.warn("[plan-exec] lease release failed id={}",executionId,e);}
        }
    }

    // ── Decision (one REQUIRES_NEW transaction under the row lock) ─────────────────────────────────────────────────
    record Submission(String stepId,String stage,String clientRequestId,RunRequest request,String userId,String projectId) {}
    record Decision(Submission submission,String unbindThread) {
        Decision(Submission submission){this(submission,null);}
    }
    record Event(String type,ObjectNode data) {}

    private Decision decide(String id,String owner,long version,List<Event> out,List<Runnable> after) {
        var e=executions.lockById(id).orElse(null);
        if(e==null||!owner.equals(e.getLeaseOwner())||e.getLeaseVersion()!=version)return new Decision(null);
        ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
        ObjectNode budget=PlanState.parse(mapper,e.getBudgetJson());
        refresh(e,state,budget,out);
        Instant now=Instant.now();
        Submission next=null;
        String before=e.getStatus();
        // D03: the safe boundary. A message the user sent while this ran comes before any further submission.
        steer(e,state,after);
        switch(e.getStatus()) {
            case IpPlanExecution.CANCELED -> cancelOutstanding(e,state);
            case IpPlanExecution.RUNNING -> {
                if(e.getDeadlineAt()!=null&&now.isAfter(e.getDeadlineAt())) {
                    e.setStatus(IpPlanExecution.PARTIAL);e.setFinishedAt(now);
                    state.put("needsUserReason","连续制作超过 90 分钟，已停在这里："+progressSummary(state,e.getStage())+"。已受理的任务会继续结算。");
                } else next=advanceRunning(e,state,budget,out,after);
            }
            case IpPlanExecution.NEEDS_USER -> completeIfResolved(e,state,out,after);
            default -> {}
        }
        // D07: one completion summary per execution, posted once it reaches done / partial / failed / canceled.
        if(Set.of(IpPlanExecution.DONE,IpPlanExecution.PARTIAL,IpPlanExecution.FAILED,IpPlanExecution.CANCELED).contains(e.getStatus())
                &&!state.path("summaryPosted").asBoolean(false)&&e.getThreadId()!=null) {
            var summary=StudioExecutionSummary.build(e,state,budget,(stepRun)->outputs.run(e.getOwnerUserId(),e.getProjectId(),stepRun).orElse(null));
            state.put("summaryPosted",true);
            String thread=e.getThreadId(),executionId=e.getId();
            after.add(()->postMessage(thread,executionId,"exec-summary-"+executionId,summary.text(),List.of(),summary.suggestions()));
        }
        save(e,state,budget);
        boolean ended=!before.equals(e.getStatus())&&Set.of(IpPlanExecution.DONE,IpPlanExecution.PARTIAL,IpPlanExecution.FAILED).contains(e.getStatus());
        return new Decision(next,ended?e.getThreadId():null);
    }

    /**
     * D03: steering bound to this execution that nothing has handled yet. A running execution stops before its next
     * submission (needs_user: 「收到新指令，等待重新确认」; accepted tasks keep their snapshot), and the dialogue opens the
     * turn that reads the message, so a change request is answered with a revised plan / new approval instead of the
     * old steps continuing. Idempotent: each steering row is handled once.
     */
    private void steer(IpPlanExecution e,ObjectNode state,List<Runnable> after) {
        var source=steering==null?null:steering.getIfAvailable();
        if(source==null||e.getThreadId()==null||!IpPlanExecution.active(e.getStatus()))return;
        String latest=null;
        for(var note:source.notes(e.getThreadId(),e.getId())) {
            if("rejected".equals(note.status())||PlanState.steeringSeen(state,note.id()))continue;
            PlanState.markSteeringSeen(state,note.id());
            latest=note.text();
        }
        if(latest==null)return;
        if(IpPlanExecution.RUNNING.equals(e.getStatus()))
            needsUser(e,state,"收到新指令，等待重新确认：「"+excerpt(latest,60)+"」。已经提交的任务会照原样完成，后面的步骤先不提交。");
        String thread=e.getThreadId();
        after.add(()->source.openTurn(thread));
    }
    private void postMessage(String threadId,String executionId,String key,String text,List<ObjectNode> blocks,List<String> suggestions) {
        var target=messages==null?null:messages.getIfAvailable();
        if(target==null)return;
        target.postExecutionMessage(threadId,executionId,key,text,blocks,suggestions);
    }
    private static String excerpt(String text,int max){if(text==null)return "";String t=text.strip();return t.length()<=max?t:t.substring(0,max)+"…";}
    private void unbind(String threadId) {
        var target=dialogue==null?null:dialogue.getIfAvailable();
        if(target==null)return;
        try {target.bindExecution(threadId,null,null);}
        catch(RuntimeException e){log.warn("[plan-exec] thread unbinding failed thread={} reason={}",threadId,e.toString());}
    }

    /** Refresh every step from its native runs, then the per-stage spent / in-flight summaries. */
    private void refresh(IpPlanExecution e,ObjectNode state,ObjectNode budget,List<Event> out) {
        Map<String,Long> spent=new HashMap<>(),inFlight=new HashMap<>(),dialogueSpent=new HashMap<>(),dialogueInFlight=new HashMap<>();
        Set<String> counted=new HashSet<>(); // a charge is counted once, whichever list references it
        for(JsonNode raw:state.path("steps")) {
            ObjectNode step=(ObjectNode)raw;
            String stage=step.path("stage").asText();
            long ceiling=step.path("maxCost").asLong(step.path("quotedCost").asLong());
            if("submitted".equals(step.path("status").asText())) {
                String requestId=step.path("pendingRequestId").asText(null);
                var found=requestId==null?null:runRepository.findByProjectIdAndClientRequestId(e.getProjectId(),requestId)
                        .filter(r->e.getOwnerUserId().equals(r.getOwnerUserId())).orElse(null);
                if(found!=null) {attach(step,found.getId());}
                else {inFlight.merge(stage,ceiling,Long::sum);continue;}
            }
            ArrayNode ids=(ArrayNode)step.withArray("runIds");
            IpRunDto latest=null;
            for(int i=0;i<ids.size();i++) {
                var dto=outputs.run(e.getOwnerUserId(),e.getProjectId(),ids.get(i).asText()).orElse(null);
                if(dto==null)continue;
                if(counted.add(dto.id())) {
                    if("running".equals(dto.status()))inFlight.merge(stage,ceiling,Long::sum);
                    else spent.merge(stage,dto.cost(),Long::sum);
                }
                if(i==ids.size()-1)latest=dto;
            }
            if(latest==null)continue;
            String before=step.path("status").asText();
            switch(latest.status()) {
                case "running" -> {if(!"needs_user".equals(before))step.put("status","running");}
                case "done" -> {
                    if(!"done".equals(before)) {
                        step.put("status","done");step.remove("reason");
                        if("check".equals(step.path("operation").asText()))
                            step.put("checkStatus",latest.output()==null?"unknown":latest.output().path("check").path("status").asText("unknown"));
                        nodeEvents(e,state,step,latest,out);
                    }
                }
                case "failed" -> {
                    if(!"failed".equals(before)&&!"needs_user".equals(before)&&!"pending".equals(before)) {
                        step.put("status","failed").put("reason",latest.errorMessage()==null?"这一步没有完成":latest.errorMessage());
                        if(latest.errorCode()!=null)step.put("errorCode",latest.errorCode());
                    }
                }
                default -> {}
            }
        }
        // Dialogue child runs authorized through the gate count against the same stage budget.
        for(JsonNode raw:state.path("children")) {
            ObjectNode child=(ObjectNode)raw;
            String stage=child.path("stage").asText();long ceiling=child.path("maxCost").asLong();
            if("expired".equals(child.path("status").asText()))continue;
            if(!child.hasNonNull("runId")) {
                var found=runRepository.findByProjectIdAndClientRequestId(e.getProjectId(),child.path("clientRequestId").asText())
                        .filter(r->e.getOwnerUserId().equals(r.getOwnerUserId())).orElse(null);
                if(found!=null)child.put("runId",found.getId()).put("status","running");
                else {
                    Instant at=parseInstant(child.path("authorizedAt").asText(null));
                    // An authorization never followed by a run releases its occupation after a grace period.
                    if(at!=null&&at.plus(CHILD_GRACE).isBefore(Instant.now())){child.put("status","expired");continue;}
                    inFlight.merge(stage,ceiling,Long::sum);continue;
                }
            }
            var dto=outputs.run(e.getOwnerUserId(),e.getProjectId(),child.path("runId").asText()).orElse(null);
            if(dto==null||!counted.add(dto.id()))continue;
            if("running".equals(dto.status()))inFlight.merge(stage,ceiling,Long::sum);
            else {spent.merge(stage,dto.cost(),Long::sum);child.put("status",dto.status());}
        }
        // D06: parent dialogue turns attributed to a stage: ceiling in flight while running, real credits once settled.
        for(JsonNode raw:state.path("dialogueRuns")) {
            ObjectNode turn=(ObjectNode)raw;
            String stage=turn.path("stage").asText();long ceiling=turn.path("maxCost").asLong();
            var dto=outputs.run(e.getOwnerUserId(),e.getProjectId(),turn.path("runId").asText()).orElse(null);
            if(dto==null||!counted.add(dto.id()))continue;
            if("running".equals(dto.status())){inFlight.merge(stage,ceiling,Long::sum);dialogueInFlight.merge(stage,ceiling,Long::sum);}
            else {spent.merge(stage,dto.cost(),Long::sum);dialogueSpent.merge(stage,dto.cost(),Long::sum);turn.put("status",dto.status()).put("cost",dto.cost());}
        }
        for(String stage:StudioSkillRules.STAGES) {
            JsonNode existing=budget.path(stage);
            if(!existing.isObject())continue;
            long s=spent.getOrDefault(stage,0L),f=inFlight.getOrDefault(stage,0L),ds=dialogueSpent.getOrDefault(stage,0L),df=dialogueInFlight.getOrDefault(stage,0L);
            if(existing.path("spent").asLong(-1)!=s||existing.path("inFlight").asLong(-1)!=f
                    ||existing.path("dialogueSpent").asLong(0)!=ds||existing.path("dialogueInFlight").asLong(0)!=df) {
                ((ObjectNode)existing).put("spent",s).put("inFlight",f).put("dialogueSpent",ds).put("dialogueInFlight",df);
                out.add(budgetEvent(e,stage,(ObjectNode)existing,null,"actual"));
            }
        }
        e.setSpent(spent.getOrDefault(e.getStage(),0L));e.setInFlight(inFlight.getOrDefault(e.getStage(),0L)+otherStagesInFlight(inFlight,e.getStage()));
    }
    private static Instant parseInstant(String value) {
        try {return value==null?null:Instant.parse(value);} catch(RuntimeException e){return null;}
    }
    private static long otherStagesInFlight(Map<String,Long> inFlight,String stage) {
        long total=0;for(var entry:inFlight.entrySet())if(!entry.getKey().equals(stage))total+=entry.getValue();return total;
    }
    private static void attach(ObjectNode step,String runId) {
        ArrayNode ids=(ArrayNode)step.withArray("runIds");
        boolean present=false;for(JsonNode id:ids)present|=runId.equals(id.asText());
        if(!present)ids.add(runId);
        step.remove("pendingRequestId");step.put("status","running");
    }

    /** Running: stop on failures / unresolved checks, then submit the next ready step if the stage budget allows. */
    private Submission advanceRunning(IpPlanExecution e,ObjectNode state,ObjectNode budget,List<Event> out,List<Runnable> after) {
        String stage=e.getStage();
        for(JsonNode step:PlanState.stageSteps(state,stage)) {
            if("failed".equals(step.path("status").asText())) {
                return needsUser(e,state,"「"+step.path("title").asText()+"」没有完成："+step.path("reason").asText("原因未知")+"。可以继续重试这一步，或结束本次制作。");
            }
            if(PlanState.unresolvedCheck(state,step)) {
                return needsUser(e,state,"检查「"+step.path("title").asText()+"」认为有问题或无法判断。请看检查建议，决定采用当前版本、修改后重做，或继续下一步。");
            }
            if("needs_user".equals(step.path("status").asText()))return needsUser(e,state,step.path("reason").asText("「"+step.path("title").asText()+"」需要你确认"));
        }
        ObjectNode ready=null;
        for(JsonNode raw:PlanState.stageSteps(state,stage)) {
            String status=raw.path("status").asText();
            // A persisted request without a run: resubmit with the same identity (idempotent), budget already counted.
            if("submitted".equals(status)){ready=(ObjectNode)raw;break;}
            if("pending".equals(status)&&PlanState.dependenciesDone(state,raw)){ready=(ObjectNode)raw;break;}
        }
        if(ready==null) {
            completeIfResolved(e,state,out,after);
            return null;
        }
        boolean resubmit="submitted".equals(ready.path("status").asText());
        if(!resubmit&&"confirm".equals(ready.path("execution").asText())&&!ready.path("confirmed").asBoolean(false)) {
            ready.put("status","needs_user").put("reason","「"+ready.path("title").asText()+"」需要你确认后再继续");
            return needsUser(e,state,ready.path("reason").asText());
        }
        ObjectNode stageBudget=(ObjectNode)budget.path(stage);
        long quoted=ready.path("quotedCost").asLong();
        long spent=stageBudget.path("spent").asLong(),inFlight=stageBudget.path("inFlight").asLong(),cap=stageBudget.path("approvedCap").asLong();
        if(!resubmit&&spent+inFlight+quoted>cap) {
            long shortfall=spent+inFlight+quoted-cap;
            ready.put("status","needs_user").put("reason","本阶段预算还差 "+shortfall+" 积分");
            stageBudget.put("shortfall",shortfall);
            out.add(budgetEvent(e,stage,stageBudget,shortfall,"quote"));
            raiseCard(e,state,stage,stageBudget,remainingQuote(state,stage),cap+shortfall,shortfall,ready.path("title").asText(),after);
            return needsUser(e,state,"预算不够：本阶段已花 "+spent+" 积分、在途 "+inFlight+" 积分，下一步「"+ready.path("title").asText()+"」需要 "+quoted+" 积分，超出已批准的 "+cap+" 积分 "+shortfall+" 积分。可以追加预算或缩小计划。");
        }
        stageBudget.remove("shortfall");
        String requestId=StudioPlanExecutionIds.requestId(e.getId(),stage,ready.path("id").asText(),ready.path("attempt").asInt(1));
        RunRequest request;
        try {request=compile(e,state,ready,requestId);}
        catch(BusinessException error) {
            ready.put("status","needs_user").put("reason",error.getMessage());
            return needsUser(e,state,"「"+ready.path("title").asText()+"」还不能开始："+error.getMessage());
        }
        // Persist the request identity and the conservative budget occupation before the native call.
        ready.put("status","submitted").put("pendingRequestId",requestId).put("maxCost",quoted);
        stageBudget.put("inFlight",inFlight+(resubmit?0:quoted));
        e.setInFlight(e.getInFlight()+(resubmit?0:quoted));
        return new Submission(ready.path("id").asText(),stage,requestId,request,e.getOwnerUserId(),e.getProjectId());
    }

    private Submission needsUser(IpPlanExecution e,ObjectNode state,String reason) {
        e.setStatus(IpPlanExecution.NEEDS_USER);state.put("needsUserReason",reason);
        return null;
    }

    /** Stage end: analysis waits for the production confirmation; production is done once every check is resolved. */
    private void completeIfResolved(IpPlanExecution e,ObjectNode state,List<Event> out,List<Runnable> after) {
        String stage=e.getStage();
        boolean finished=true,unresolved=false;
        for(JsonNode step:PlanState.stageSteps(state,stage)) {
            String status=step.path("status").asText();
            if(!"done".equals(status)&&!"skipped".equals(status)){finished=false;break;}
            unresolved|=PlanState.unresolvedCheck(state,step);
        }
        if(!finished)return;
        if("analysis".equals(stage)) {
            boolean announced=state.path("analysisAnnounced").asBoolean(false);
            e.setStatus(IpPlanExecution.NEEDS_USER);
            state.put("needsUserReason","分析已完成，请确认制作方案和预算后开始制作。");
            if(!announced) {
                state.put("analysisAnnounced",true);
                productionPlan(e,state).ifPresent(plan->productionCard(e,plan,after));
            }
        } else if(unresolved) {
            e.setStatus(IpPlanExecution.NEEDS_USER);
            state.put("needsUserReason","成片已做完，但有检查没通过或无法判断。请看检查建议，决定采用当前版本或修改重做。");
        } else {
            e.setStatus(IpPlanExecution.DONE);e.setFinishedAt(Instant.now());state.remove("needsUserReason");
        }
    }

    /** Canceled: stop new submissions (pending → skipped) and ask cancellable queued runs to stop; accepted ones settle. */
    private void cancelOutstanding(IpPlanExecution e,ObjectNode state) {
        for(JsonNode raw:state.path("steps")) {
            ObjectNode step=(ObjectNode)raw;
            String status=step.path("status").asText();
            if(Set.of("pending","needs_user").contains(status)){step.put("status","skipped");continue;}
            if(!"running".equals(status)||step.path("cancelRequested").asBoolean(false))continue;
            step.put("cancelRequested",true);
            for(JsonNode id:step.path("runIds")) {
                // Own transaction: a refused cancel (already with the provider) must not mark this decision rollback-only.
                try {tx.executeWithoutResult(inner->runs.cancel(e.getOwnerUserId(),id.asText()));}
                catch(BusinessException alreadySubmitted) {/* Already with the provider: the native chain queries and settles it. */}
                catch(RuntimeException error) {log.warn("[plan-exec] cancel run failed execution={} run={}",e.getId(),id.asText(),error);}
            }
        }
    }

    private void save(IpPlanExecution e,ObjectNode state,ObjectNode budget) {
        try {
            e.setStepsJson(mapper.writeValueAsString(state));e.setBudgetJson(mapper.writeValueAsString(budget));
        } catch(Exception error){throw new IllegalStateException(error);}
        e.setUpdatedAt(Instant.now());
        executions.save(e);
    }

    // ── Submission (outside the lease transaction; the native submit owns its own transaction and afterCommit) ──────
    private boolean submit(String id,String owner,long version,Submission submission) {
        String runId=null;BusinessException rejected=null;
        try {
            runId=workflow.submit(submission.userId(),submission.projectId(),submission.request()).id();
        } catch(BusinessException error) {
            rejected=error;
        } catch(RuntimeException unknown) {
            // Outcome unknown: keep the persisted request and its budget occupation; the next wake looks it up first.
            log.warn("[plan-exec] submit outcome unknown execution={} step={} request={}",id,submission.stepId(),submission.clientRequestId(),unknown);
            return false;
        }
        final String accepted=runId;final BusinessException failure=rejected;
        List<Event> pending=new ArrayList<>();
        Boolean kept=tx.execute(status->{
            var e=executions.lockById(id).orElse(null);
            if(e==null||!owner.equals(e.getLeaseOwner())||e.getLeaseVersion()!=version)return false;
            ObjectNode state=PlanState.parse(mapper,e.getStepsJson());
            ObjectNode step=PlanState.step(state,submission.stage(),submission.stepId());
            if(step==null)return false;
            // A pause/stop between the decision and the submit bumps the lease version, so it never reaches here.
            if(accepted!=null)attach(step,accepted);
            else {
                step.put("status","needs_user").put("reason",failure.getMessage());step.remove("pendingRequestId");
                if(failure.getCode()!=null)step.put("errorCode",failure.getCode());
                e.setStatus(IpPlanExecution.NEEDS_USER);
                state.put("needsUserReason","「"+step.path("title").asText()+"」没有提交："+failure.getMessage());
            }
            save(e,state,PlanState.parse(mapper,e.getBudgetJson()));
            return accepted!=null;
        });
        publish(id,pending);
        if(failure!=null)log.info("[plan-exec] step rejected execution={} step={} code={} message={}",id,submission.stepId(),failure.getCode(),failure.getMessage());
        return Boolean.TRUE.equals(kept);
    }

    /** Compile a step into its native request with real keys from canvas nodes and earlier accepted/successful runs. */
    private RunRequest compile(IpPlanExecution e,ObjectNode state,ObjectNode step,String requestId) {
        JsonNode doc=projects.readDoc(projects.required(e.getOwnerUserId(),e.getProjectId()));
        JsonNode steps=state.path("steps");
        String stage=step.path("stage").asText();
        JsonNode definition=step.path("definition");
        var keys=new StudioPlanSteps.Keys() {
            @Override public String binding(JsonNode binding) {
                if(binding.hasNonNull("nodeId"))return outputs.resolveNodeKey(e,steps,doc,binding.path("nodeId").asText());
                return stepKey(e,state,stage,binding.path("stepId").asText(),null);
            }
            @Override public String clip(JsonNode clip) {
                return stepKey(e,state,stage,clip.path("stepId").asText(),clip.hasNonNull("candidateIndex")?clip.path("candidateIndex").asInt():null);
            }
            @Override public String sourceAudio() {return outputs.sourceAudio(e,steps);}
            @Override public String aspectRatio() {
                for(JsonNode clip:definition.path("settings").path("clipOrder")) {
                    var target=PlanState.step(state,stage,clip.path("stepId").asText());
                    String ratio=target==null?null:target.path("definition").path("settings").path("aspectRatio").asText(null);
                    if(ratio!=null&&List.of("9:16","16:9","1:1").contains(ratio))return ratio;
                }
                return "9:16";
            }
        };
        CheckSettings check=null;
        if("check".equals(step.path("operation").asText())) {
            JsonNode settings=definition.path("settings");
            var target=PlanState.step(state,stage,settings.path("targetStepId").asText());
            String targetRun=target==null?null:outputs.chosenRun(e.getOwnerUserId(),e.getProjectId(),target).orElse(null);
            if(targetRun==null)throw StudioPlanOutputs.missing();
            Integer candidate=target.hasNonNull("acceptedCandidateIndex")?Integer.valueOf(target.path("acceptedCandidateIndex").asInt())
                    :settings.hasNonNull("candidateIndex")?Integer.valueOf(settings.path("candidateIndex").asInt()):null;
            var dto=outputs.run(e.getOwnerUserId(),e.getProjectId(),targetRun).orElseThrow(StudioPlanOutputs::missing);
            String key=outputs.outputKey(dto,candidate);
            if(key==null)throw StudioPlanOutputs.missing();
            List<String> ids=new ArrayList<>();settings.path("checkIds").forEach(v->ids.add(v.asText()));
            check=new CheckSettings(targetRun,key,ids);
            step.put("checkTargetRunId",targetRun);
        }
        List<String> canvas=new ArrayList<>();
        for(JsonNode ref:state.path("canvasContextIds"))canvas.add(ref.asText());
        BillingSelection billing=billing(e);
        String nodeId=StudioPlanExecutionIds.nodeId(e.getId(),stage,step.path("id").asText());
        var binding=new StudioPlanSteps.Binding(requestId,nodeId,step.path("quotedCost").asLong(),billing,e.getId(),e.getSkillKey(),e.getSkillVersion(),stage,canvas,check);
        return StudioPlanSteps.request(definition,keys,quoter.modes(),binding);
    }

    private String stepKey(IpPlanExecution e,ObjectNode state,String stage,String stepId,Integer candidate) {
        var target=PlanState.step(state,stage,stepId);
        if(target==null)throw StudioPlanOutputs.missing();
        String runId=outputs.chosenRun(e.getOwnerUserId(),e.getProjectId(),target).orElseThrow(StudioPlanOutputs::missing);
        Integer index=candidate!=null?candidate:target.hasNonNull("acceptedCandidateIndex")?Integer.valueOf(target.path("acceptedCandidateIndex").asInt()):null;
        var dto=outputs.run(e.getOwnerUserId(),e.getProjectId(),runId).orElseThrow(StudioPlanOutputs::missing);
        String key=outputs.outputKey(dto,index);
        if(key==null)throw StudioPlanOutputs.missing();
        return key;
    }

    BillingSelection billing(IpPlanExecution e) {
        JsonNode billing=PlanState.parse(mapper,e.getBillingJson());
        return "enterprise".equals(billing.path("mode").asText())?new BillingSelection("enterprise",billing.path("enterpriseId").asText())
                :new BillingSelection("personal",null);
    }

    // ── Events (published after the state they describe is committed) ─────────────────────────────────────────────
    private void publish(String executionId,List<Event> pending) {
        if(pending.isEmpty())return;
        var sink=events.getIfAvailable();
        if(sink==null)return;
        var e=executions.findById(executionId).orElse(null);
        if(e==null||e.getThreadId()==null)return;
        for(Event event:pending) {
            try {sink.publish(e.getThreadId(),e.getId(),event.data().path("runId").asText(null),e.getId(),event.type(),event.data());}
            catch(RuntimeException error) {log.warn("[plan-exec] event publish failed execution={} type={}",executionId,event.type(),error);}
        }
    }

    /**
     * Client projection of a finished step (the server never writes the canvas document): one node per step with its real
     * output key or text, a check node beside the video it inspected, one video node per film-study segment clip, and
     * connections from the step's inputs. Node ids are stable, so repeated events are idempotent on the client.
     */
    private void nodeEvents(IpPlanExecution e,ObjectNode state,ObjectNode step,IpRunDto run,List<Event> out) {
        String stage=step.path("stage").asText(),stepId=step.path("id").asText(),operation=step.path("operation").asText();
        String nodeId=StudioPlanExecutionIds.nodeId(e.getId(),stage,stepId);
        JsonNode output=run.output()==null?mapper.createObjectNode():run.output();
        String type=switch(operation){case "image" -> "image";case "video","assemble" -> "video";default -> "text";};
        String title=step.path("title").asText();
        ObjectNode data=nodeData(e,nodeId,type,title,stepId,run.id());
        ObjectNode metadata=(ObjectNode)data.path("node").path("metadata");ObjectNode studio=(ObjectNode)metadata.path("studio");
        switch(operation) {
            case "image","video","assemble" -> {
                String key=outputs.outputKey(run,null);
                if(key!=null)metadata.put("storageKey",key);
                if("assemble".equals(operation))studio.put("kind","work");
            }
            case "check" -> {
                String target=step.path("definition").path("settings").path("targetStepId").asText();
                var subject=PlanState.step(state,stage,target);
                String subjectId=StudioPlanExecutionIds.nodeId(e.getId(),stage,target);
                ((ObjectNode)data.path("node")).put("title",(subject==null?"成片":subject.path("title").asText())+" · 检查");
                studio.put("kind","check").put("parentNodeId",subjectId);
                if(output.path("check").isObject())studio.set("check",output.path("check"));
                data.putObject("connection").put("fromNodeId",subjectId).put("toNodeId",nodeId);
            }
            case "recreation" -> {studio.put("kind","recreation");metadata.put("content",output.path("text").asText(""));}
            default -> {studio.put("kind","text");metadata.put("content",output.path("textRevision").path("content").asText(output.path("text").asText("")));}
        }
        out.add(new Event("node.upsert",data));
        if(!"check".equals(operation))for(JsonNode dependency:step.path("dependsOn")) {
            var upstream=PlanState.step(state,stage,dependency.asText());
            if(upstream==null||"check".equals(upstream.path("operation").asText()))continue;
            var connect=mapper.createObjectNode().put("nodeId",nodeId).put("op","connect").put("executionId",e.getId()).put("stepId",stepId).put("runId",run.id());
            connect.putObject("connection").put("fromNodeId",StudioPlanExecutionIds.nodeId(e.getId(),stage,dependency.asText())).put("toNodeId",nodeId);
            out.add(new Event("node.upsert",connect));
        }
        if("recreation".equals(operation))for(JsonNode segment:output.path("filmStudy").path("segments")) {
            if(!segment.hasNonNull("storageKey"))continue;
            int no=segment.path("no").asInt();
            String segmentId=StudioPlanExecutionIds.segmentNodeId(e.getId(),stage,stepId,no);
            var clip=nodeData(e,segmentId,"video","第 "+no+" 段 · "+segment.path("title").asText("片段"),stepId,run.id());
            var clipMeta=(ObjectNode)clip.path("node").path("metadata");
            clipMeta.put("storageKey",segment.path("storageKey").asText());
            ((ObjectNode)clipMeta.path("studio")).putObject("sourceRange").put("startSec",segment.path("startSec").asDouble()).put("endSec",segment.path("endSec").asDouble())
                    .put("storageKey",segment.path("storageKey").asText());
            clip.putObject("connection").put("fromNodeId",nodeId).put("toNodeId",segmentId);
            out.add(new Event("node.upsert",clip));
        }
    }
    private ObjectNode nodeData(IpPlanExecution e,String nodeId,String type,String title,String stepId,String runId) {
        var data=mapper.createObjectNode().put("nodeId",nodeId).put("op","create").put("executionId",e.getId()).put("stepId",stepId).put("runId",runId);
        var node=data.putObject("node").put("id",nodeId).put("type",type).put("title",title).put("width","text".equals(type)?380:320).put("height","text".equals(type)?320:240);
        node.putObject("position").put("x",0).put("y",0);
        var studio=node.putObject("metadata").put("status","success").putObject("studio").put("runId",runId);
        studio.putObject("execution").put("executionId",e.getId()).put("stepId",stepId).put("runId",runId);
        return data;
    }
    private Event budgetEvent(IpPlanExecution e,String stage,ObjectNode stageBudget,Long shortfall,String source) {
        long cap=stageBudget.path("approvedCap").asLong(),spent=stageBudget.path("spent").asLong(),inFlight=stageBudget.path("inFlight").asLong();
        var data=mapper.createObjectNode().put("executionId",e.getId()).put("stage",stage).put("approvedCap",cap).put("spent",spent)
                .put("inFlight",inFlight).put("remaining",Math.max(0,cap-spent-inFlight)).put("source",source)
                // the parent-dialogue share of spent / inFlight (already included in the totals, never added twice)
                .put("dialogueSpent",stageBudget.path("dialogueSpent").asLong(0)).put("dialogueInFlight",stageBudget.path("dialogueInFlight").asLong(0));
        if(shortfall!=null)data.put("shortfall",shortfall);
        return new Event("budget.update",data);
    }
    /**
     * A budget shortfall becomes a real card on the thread (a persisted assistant message), so it can be confirmed by the
     * button or in words like any other card. Its id includes the proposed cap: every shortfall is its own card.
     */
    private void raiseCard(IpPlanExecution e,ObjectNode state,String stage,ObjectNode stageBudget,long quoted,long budgetCap,long shortfall,String nextTitle,List<Runnable> after) {
        if(e.getThreadId()==null)return;
        String approvalId=StudioPlanExecutionIds.approvalId(e.getId(),stage,e.getPlanRunId(),e.getPlanFingerprint()+"|raise|"+budgetCap);
        var block=approvalBlock(e,stage,approvalId,e.getPlanFingerprint(),PlanState.stageTitles(state,stage),quoted,budgetCap,stageBudget.path("autoFixCap").asLong(0));
        block.put("shortfall",shortfall);
        String text="预算不够了：下一步「"+nextTitle+"」需要的积分超出了本"+stageLabel(stage)+"已批准的上限，还差 "+shortfall+" 积分。"
                +"确认把上限提高到 "+budgetCap+" 积分后，我接着做；也可以缩小范围或结束这次制作。";
        String thread=e.getThreadId(),executionId=e.getId();
        after.add(()->postMessage(thread,executionId,"exec-card-"+approvalId,text,List.of(block),null));
    }

    /**
     * The production plan an analysis compiled (a native plan-compile run): posted as the thread's newest plan revision
     * with its card, so it can be confirmed (D02 needs a real card; D01 makes it the current revision).
     */
    private void productionCard(IpPlanExecution e,ProductionPlan plan,List<Runnable> after) {
        if(e.getThreadId()==null)return;
        String fingerprint=plan.plan().path("fingerprint").asText();
        long estimated=plan.plan().path("budget").path("estimated").asLong(),autoFix=plan.plan().path("budget").path("autoFixCap").asLong(0);
        var target=messages==null?null:messages.getIfAvailable();
        long reserve=target==null?0:Math.max(0,target.dialogueReserve(e.getOwnerUserId()));
        String approvalId=StudioPlanExecutionIds.approvalId(e.getId(),"production",plan.runId(),fingerprint);
        var planBlock=mapper.createObjectNode().put("type","plan").put("planRunId",plan.runId()).put("fingerprint",fingerprint);
        planBlock.set("plan",plan.plan().deepCopy());
        var card=approvalBlock(e,"production",approvalId,fingerprint,titles(plan.plan()),estimated,estimated+autoFix+reserve,autoFix);
        if(reserve>0)card.put("dialogueReserve",reserve);
        String text="分析做完了。我按分析结果整理了制作方案，共 "+plan.plan().path("steps").size()+" 步，当前报价 "+estimated+" 积分。确认方案和预算后开始制作。";
        String thread=e.getThreadId(),executionId=e.getId();
        after.add(()->postMessage(thread,executionId,"exec-card-"+approvalId,text,List.of(planBlock,card),null));
    }
    private ObjectNode approvalBlock(IpPlanExecution e,String stage,String approvalId,String fingerprint,List<String> scope,long quoted,long budgetCap,long autoFixCap) {
        var block=mapper.createObjectNode().put("type","approval").put("approvalId",approvalId).put("stage",stage).put("planFingerprint",fingerprint);
        var items=block.putArray("scope");scope.stream().limit(8).forEach(items::add);
        block.put("quotedCost",quoted).put("budgetCap",budgetCap).put("autoFixCap",Math.min(autoFixCap,budgetCap)).put("status","pending").put("executionId",e.getId());
        block.set("billingSelection",mapper.valueToTree(billing(e)));
        block.put("expiresAt",Instant.now().plus(Duration.ofHours(24)).toString());
        return block;
    }
    private static String stageLabel(String stage){return "production".equals(stage)?"制作阶段":"分析阶段";}
    private static List<String> titles(JsonNode plan){List<String> out=new ArrayList<>();plan.path("steps").forEach(s->out.add(s.path("title").asText()));return out;}

    record ProductionPlan(String runId,JsonNode plan) {}
    /** A production plan compiled by an analysis plan-compile step, read from that native run's output. */
    Optional<ProductionPlan> productionPlan(IpPlanExecution e,ObjectNode state) {
        for(JsonNode step:PlanState.stageSteps(state,"analysis")) {
            if(!"text".equals(step.path("operation").asText())||!"plan-compile".equals(step.path("definition").path("settings").path("purpose").asText()))continue;
            String runId=outputs.chosenRun(e.getOwnerUserId(),e.getProjectId(),step).orElse(null);
            var dto=runId==null?null:outputs.run(e.getOwnerUserId(),e.getProjectId(),runId).orElse(null);
            if(dto!=null&&dto.output()!=null&&dto.output().path("plan").isObject())return Optional.of(new ProductionPlan(runId,dto.output().path("plan")));
        }
        return Optional.empty();
    }
    private static long remainingQuote(ObjectNode state,String stage) {
        long total=0;
        for(JsonNode step:PlanState.stageSteps(state,stage))if(Set.of("pending","needs_user","submitted").contains(step.path("status").asText()))total+=step.path("quotedCost").asLong();
        return total;
    }
    private static String progressSummary(ObjectNode state,String stage) {
        int done=0,running=0,waiting=0;
        for(JsonNode step:PlanState.stageSteps(state,stage)) {
            switch(step.path("status").asText()){case "done","skipped" -> done++;case "running","submitted" -> running++;default -> waiting++;}
        }
        return "已完成 "+done+" 步，进行中 "+running+" 步，尚未执行 "+waiting+" 步";
    }
}
