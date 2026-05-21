package com.aistareco.aep.repository;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    /**
     * v0.22: 任务追踪「按批次聚合」第一查 —— 拉某用户的 distinct projectId 列表，
     * 携带每批最近一次 created_at 用作排序键。
     *
     * 返回 Object[] 数组：`[0]=projectId(String), [1]=lastCreatedAt(Instant)`。
     * 调用方拼 `Pageable.of(page, size, Sort.by(DESC, "maxC"))`；JPQL alias 在 H2
     * 与 MySQL 上都可作为 ORDER BY 列名（用别名 maxC 而不是 MAX(j.createdAt) 是为了
     * 让 Pageable.getSort() 渲出来的 ORDER BY 子句能命中聚合表达式）。
     */
    @Query("SELECT j.projectId AS pid, MAX(j.createdAt) AS maxC "
            + "FROM PublishJob j WHERE j.userId = :uid "
            + "GROUP BY j.projectId")
    Page<Object[]> findBatchProjectIdsByUserId(@Param("uid") String userId, Pageable pageable);

    /**
     * v0.22: 第二查 —— 把上一查返回的若干个 projectId 一次性 IN 查出所有 row，
     * service 层在 Java 里聚合成 PublishBatchSummaryDto。
     *
     * 与单查 `SUM(CASE WHEN status='X' THEN 1 END)` 八列 + 用户层 distinct platform
     * 相比，本方案行数可控（一页 ≤ size×batch_size，典型 ≤ 600 行）、SQL 简单，
     * 也避免了 JPQL constructor + Map 反序列化的样板。
     */
    List<PublishJob> findByUserIdAndProjectIdInOrderByCreatedAtAsc(String userId, Collection<String> projectIds);
}
