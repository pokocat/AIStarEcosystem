package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.service.materialvideo.MaterialVideoJobEnded;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Studio 的视频子任务一结束就推进它的制作计划，不等 60 秒巡检。
 * 任务不记属于哪份计划，但只归一个人，一个人同时在跑的计划很少：把这个人还在跟踪的计划都叫醒一遍，
 * 推进本身抢租约、可重入，多叫一次只是空转。
 */
@Component
public class StudioVideoJobWake {
    private static final Logger log = LoggerFactory.getLogger(StudioVideoJobWake.class);
    private final IpPlanExecutionRepository executions;
    private final ObjectProvider<StudioPlanExecutor> executor;

    public StudioVideoJobWake(IpPlanExecutionRepository executions, ObjectProvider<StudioPlanExecutor> executor) {
        this.executions = executions; this.executor = executor;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onEnded(MaterialVideoJobEnded ended) {
        if (!MaterialVideoJobService.APP_IPSTUDIO.equals(ended.app()) || ended.ownerUserId() == null) return;
        var target = executor.getIfAvailable();
        if (target == null) return;
        try {
            for (var e : executions.findByOwnerUserIdAndStatusIn(ended.ownerUserId(), StudioPlanExecutor.TRACKED)) target.wake(e.getId());
        } catch (RuntimeException e) {
            // 只影响「多快知道」：叫不醒就照旧等巡检。
            log.warn("[plan-exec] video job wake failed job={} reason={}", ended.jobId(), e.toString());
        }
    }
}
