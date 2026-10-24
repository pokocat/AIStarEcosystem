package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.StudioExecutionControl;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Optional;

/**
 * The dialogue's view of and priority controls on the plan execution bound to a thread: stop (= cancel), pause and
 * resume go through {@link StudioPlanExecutionService#control} (idempotent on the control id), the snapshot shows the
 * execution, and steering or a settled bound turn wakes the shared advance entry.
 */
@Component
public class StudioPlanExecutionControl implements StudioExecutionControl {
    private static final List<String> ACTIVE=List.of(IpPlanExecution.RUNNING,IpPlanExecution.PAUSED,IpPlanExecution.NEEDS_USER);
    private final IpPlanExecutionRepository executions;
    private final ObjectProvider<StudioPlanExecutionService> service;
    private final ObjectProvider<StudioPlanExecutor> executor;
    private final ObjectMapper mapper;
    public StudioPlanExecutionControl(IpPlanExecutionRepository executions,ObjectProvider<StudioPlanExecutionService> service,
            ObjectProvider<StudioPlanExecutor> executor,ObjectMapper mapper) {
        this.executions=executions;this.service=service;this.executor=executor;this.mapper=mapper;
    }

    @Override public void stop(String userId,String projectId,String executionId,String controlId){service.getObject().control(userId,executionId,"stop",controlId);}
    @Override public void pause(String userId,String projectId,String executionId,String controlId){service.getObject().control(userId,executionId,"pause",controlId);}
    @Override public boolean releaseForSwitch(String userId,String projectId,String executionId){return service.getObject().releaseForSwitch(userId,projectId,executionId);}
    @Override public void resume(String userId,String projectId,String executionId,String controlId){service.getObject().control(userId,executionId,"resume",controlId);}

    @Override
    public Object describe(String userId,String projectId,String executionId) {
        try {return service.getObject().read(userId,projectId,executionId);}
        catch(BusinessException notVisible) {return null;}
    }

    @Override
    public Optional<ExecutionView> active(String userId,String projectId,String threadId) {
        return executions.findByProjectIdAndStatusIn(projectId,ACTIVE).stream()
                .filter(e->userId.equals(e.getOwnerUserId())&&threadId!=null&&threadId.equals(e.getThreadId())).findFirst()
                .map(e->new ExecutionView(e.getId(),e.getStage(),e.getStatus()));
    }

    /** Same filter as {@link #active}, one query for the whole canvas instead of one per thread. */
    @Override
    public java.util.Map<String,ExecutionView> activeByThread(String userId,String projectId,java.util.Collection<String> threadIds) {
        java.util.Map<String,ExecutionView> out=new java.util.HashMap<>();
        for(var e:executions.findByProjectIdAndStatusIn(projectId,ACTIVE))
            if(userId.equals(e.getOwnerUserId())&&e.getThreadId()!=null&&threadIds.contains(e.getThreadId()))
                out.putIfAbsent(e.getThreadId(),new ExecutionView(e.getId(),e.getStage(),e.getStatus()));
        return out;
    }

    @Override
    public void wake(String executionId) {
        var target=executor.getIfAvailable();
        if(target!=null)target.wake(executionId);
    }

    /** Facts from the execution record only: stage, status, why it waits, and the stage budget. */
    @Override
    public String promptSummary(String userId,String projectId,String executionId) {
        var e=executions.findById(executionId).filter(x->userId.equals(x.getOwnerUserId())&&projectId.equals(x.getProjectId())).orElse(null);
        if(e==null)return null;
        String stage="production".equals(e.getStage())?"制作阶段":"分析阶段";
        String status=switch(e.getStatus()){
            case IpPlanExecution.RUNNING -> "进行中";case IpPlanExecution.PAUSED -> "已暂停";case IpPlanExecution.NEEDS_USER -> "停下等用户决定";
            case IpPlanExecution.DONE -> "已完成";case IpPlanExecution.PARTIAL -> "超时停在中途";case IpPlanExecution.CANCELED -> "已停止";default -> "没有完成";
        };
        JsonNode state=PlanState.parse(mapper,e.getStepsJson()),budget=PlanState.parse(mapper,e.getBudgetJson()).path(e.getStage());
        StringBuilder out=new StringBuilder(stage).append("，").append(status);
        String reason=state.path("needsUserReason").asText("");
        if(!reason.isBlank())out.append("（").append(reason).append("）");
        if(budget.isObject())out.append("；本阶段上限 ").append(budget.path("approvedCap").asLong()).append(" 积分，已花 ")
                .append(budget.path("spent").asLong()).append(" 积分，在途 ").append(budget.path("inFlight").asLong()).append(" 积分");
        out.append("。改动未来步骤需要提出新一版方案并请用户确认；用户只是在问进度时，如实回答，并告诉用户确认后可以继续原来的制作。");
        return out.toString();
    }
}
