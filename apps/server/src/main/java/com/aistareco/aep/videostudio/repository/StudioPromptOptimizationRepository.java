package com.aistareco.aep.videostudio.repository;

import com.aistareco.aep.videostudio.model.StudioPromptOptimization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 智能优化记录。状态迁移只走下面四条**条件更新**：返回 1 = 抢到了这次迁移（该去扣 / 退积分），
 * 返回 0 = 已经被别人（worker / 兜底回收）改过，什么都别做。读改写会让两边同时以为自己赢了。
 */
@Repository
public interface StudioPromptOptimizationRepository extends JpaRepository<StudioPromptOptimization, String> {

    Optional<StudioPromptOptimization> findByOwnerUserIdAndClientRequestId(String ownerUserId, String clientRequestId);

    List<StudioPromptOptimization> findByStatusInAndUpdatedAtBefore(Collection<String> statuses, Instant cutoff);

    /** queued → running（worker 开工）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update StudioPromptOptimization o set o.status = 'running', o.updatedAt = :now "
            + "where o.id = :id and o.status = 'queued'")
    int claimRunning(@Param("id") String id, @Param("now") Instant now);

    /** running → succeeded。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update StudioPromptOptimization o set o.status = 'succeeded', o.optimizedPrompt = :prompt, "
            + "o.vendorOptimizationId = :vendorId, o.errorMessage = null, o.updatedAt = :now, o.completedAt = :now "
            + "where o.id = :id and o.status = 'running'")
    int finishSucceeded(@Param("id") String id, @Param("prompt") String optimizedPrompt,
                        @Param("vendorId") String vendorOptimizationId, @Param("now") Instant now);

    /** queued / running → failed（worker 失败、派发失败）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update StudioPromptOptimization o set o.status = 'failed', o.errorMessage = :message, "
            + "o.updatedAt = :now, o.completedAt = :now "
            + "where o.id = :id and o.status in ('queued', 'running')")
    int finishFailed(@Param("id") String id, @Param("message") String message, @Param("now") Instant now);

    /**
     * queued / running → failed，但只在它<b>仍然卡住</b>（{@code updated_at < cutoff}）时 —— 兜底回收专用。
     * 回收先列出卡住的记录再逐条结算，中间 worker 可能刚把其中一条领走（{@link #claimRunning} 刷新了
     * updated_at、正在调厂商）；不带 cutoff 再判一次，就会把刚开工的判失败、退钱，厂商结果回来只能作废。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update StudioPromptOptimization o set o.status = 'failed', o.errorMessage = :message, "
            + "o.updatedAt = :now, o.completedAt = :now "
            + "where o.id = :id and o.status in ('queued', 'running') and o.updatedAt < :cutoff")
    int finishFailedIfStale(@Param("id") String id, @Param("message") String message, @Param("now") Instant now,
                            @Param("cutoff") Instant cutoff);
}
