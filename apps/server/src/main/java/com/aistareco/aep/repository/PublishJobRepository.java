package com.aistareco.aep.repository;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PublishJobRepository extends JpaRepository<PublishJob, String> {

    List<PublishJob> findByUserIdOrderByCreatedAtDesc(String userId);

    List<PublishJob> findByUserIdAndProjectIdOrderByCreatedAtDesc(String userId, String projectId);

    List<PublishJob> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, PublishJobStatus status);

    Optional<PublishJob> findByIdAndUserId(String id, String userId);

    Optional<PublishJob> findByExternalTaskId(String externalTaskId);

    List<PublishJob> findByStatusIn(Collection<PublishJobStatus> statuses);

    /**
     * v0.15+: PublishJobScheduler 扫到点未启动的定时任务。
     *
     * 匹配规则：status=QUEUED 且 (scheduledAt 为 null 或 scheduledAt<=now)。
     *  - scheduledAt=null 视为「立即派单」（v0.15 早期数据 + v0.16+ createBatch 兜底）
     *  - scheduledAt!=null 视为「定时派单」，到点才扫
     *
     * 历史踩坑：原 `findByStatusAndScheduledAtLessThanEqual` 在 SQL 层 `NULL <= now`
     * 返回 unknown，scheduledAt=null 的任务永远扫不到，造成"立即派单"必须用户手动点
     * 「开始」按钮才动。
     */
    @Query("SELECT j FROM PublishJob j WHERE j.status = :status AND (j.scheduledAt IS NULL OR j.scheduledAt <= :cutoff)")
    List<PublishJob> findDueQueuedJobs(@Param("status") PublishJobStatus status, @Param("cutoff") Instant cutoff);
}
