package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaCanvasRun;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 画布运行记录（v0.198）。
 *
 * <p><b>状态只经条件更新迁移</b>：认领、取消、成功、失败、超时回收都是 {@code UPDATE ... WHERE status IN (...)}
 * （回收再加 {@code AND updatedAt = 读到的值}），影响 0 行就说明别人先动了手，调用方放弃、不结算也不退款。
 * 禁止拿旧实体整行 {@code save} 覆盖状态 —— worker 与回收器、取消同时动手时，整行写回会把对方写的终态盖掉。
 * 结算 / 退款与这些迁移放在同一个短事务里（先改运行行、再动冻结，锁顺序固定，避免死锁）。
 */
public interface DramaCanvasRunRepository extends JpaRepository<DramaCanvasRun, String> {

    /** 幂等查重：与唯一约束 {@code uk_drama_canvas_run_owner_req} 同一组键。 */
    Optional<DramaCanvasRun> findByOwnerUserIdAndClientRequestId(String ownerUserId, String clientRequestId);

    Optional<DramaCanvasRun> findByIdAndOwnerUserIdAndCanvasId(String id, String ownerUserId, String canvasId);

    /** GET runs?ids= 批量查：只查本人、本画布的。 */
    List<DramaCanvasRun> findByOwnerUserIdAndCanvasIdAndIdIn(String ownerUserId, String canvasId, Collection<String> ids);

    /** 超时回收候选：在途且最后一次写入早于 cutoff。 */
    List<DramaCanvasRun> findByStatusInAndUpdatedAtBefore(Collection<String> statuses, OffsetDateTime cutoff);

    /**
     * 管理端对账恢复后要改回成功的视频运行：画布这边已判失败、底层视频任务现在是成功。
     * 「成片确实没有平台 key」那种（{@code DRAMA_CANVAS_VIDEO_NOT_STORED}，没带 require_mirror 的旧任务）永远恢复不了，
     * 排除掉免得每轮空转；「登记归属失败」（{@code DRAMA_CANVAS_VIDEO_RECORD_FAILED}）是可重试的，不排除。
     */
    @Query("select r from DramaCanvasRun r, MaterialVideoJob j where r.jobId = j.id and r.kind = 'video' "
            + "and r.status = 'failed' and j.status = 'succeeded' "
            + "and (r.errorCode is null or r.errorCode <> 'DRAMA_CANVAS_VIDEO_NOT_STORED') order by r.createdAt desc")
    List<DramaCanvasRun> findRecoverableVideoRuns(Pageable page);

    /** 认领（queued→running）等简单迁移。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.status = :to, r.updatedAt = :now WHERE r.id = :id AND r.status = :from")
    int transition(@Param("id") String id, @Param("from") String from, @Param("to") String to,
                   @Param("now") OffsetDateTime now);

    /** 心跳：只刷在途（queued / running）行的 updatedAt，终态行不动。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.updatedAt = :now WHERE r.id IN :ids AND r.status IN ('queued', 'running')")
    int touch(@Param("ids") Collection<String> ids, @Param("now") OffsetDateTime now);

    /** 出图进度：把追加了一张图的结果写回（只在仍 running 时）；和这张的结算在同一个事务里。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.resultJson = :result, r.updatedAt = :now WHERE r.id = :id AND r.status = 'running'")
    int progress(@Param("id") String id, @Param("result") String result, @Param("now") OffsetDateTime now);

    /** 成功收尾（从 :from 里的状态）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.status = 'succeeded', r.resultJson = :result, r.refsJson = :refs, "
            + "r.cost = :cost, r.errorCode = NULL, r.errorMessage = NULL, r.updatedAt = :now, r.finishedAt = :now "
            + "WHERE r.id = :id AND r.status IN :from")
    int succeed(@Param("id") String id, @Param("from") Collection<String> from, @Param("result") String result,
                @Param("refs") String refs, @Param("cost") long cost, @Param("now") OffsetDateTime now);

    /** 失败收尾（从 :from 里的状态）。cost / 结果 / 参考图说明都不动（契约：失败后仍显示冻结时的原值）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.status = 'failed', r.errorCode = :code, r.errorMessage = :message, "
            + "r.updatedAt = :now, r.finishedAt = :now WHERE r.id = :id AND r.status IN :from")
    int fail(@Param("id") String id, @Param("from") Collection<String> from, @Param("code") String code,
             @Param("message") String message, @Param("now") OffsetDateTime now);

    /** 取消（从 :from 里的状态）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.status = 'canceled', r.errorCode = NULL, r.errorMessage = :message, "
            + "r.updatedAt = :now, r.finishedAt = :now WHERE r.id = :id AND r.status IN :from")
    int cancel(@Param("id") String id, @Param("from") Collection<String> from, @Param("message") String message,
               @Param("now") OffsetDateTime now);

    /**
     * 超时回收：只有「仍在途、且 updatedAt 还是回收器读到的那个值」才改 —— 读到之后 worker 动过（心跳 / 进度 / 收尾），
     * 就说明它还活着，影响 0 行、放弃。{@code to} = failed，或已有结算过的图时 = succeeded（部分）。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.status = :to, r.cost = :cost, r.refsJson = :refs, r.errorCode = :code, "
            + "r.errorMessage = :message, r.updatedAt = :now, r.finishedAt = :now "
            + "WHERE r.id = :id AND r.status IN ('queued', 'running') AND r.updatedAt = :seen")
    int expireIfUnchanged(@Param("id") String id, @Param("seen") OffsetDateTime seen, @Param("to") String to,
                          @Param("cost") long cost, @Param("refs") String refs, @Param("code") String code,
                          @Param("message") String message, @Param("now") OffsetDateTime now);

    /** 只改参考图说明（在途时）：视频「比平时久」这类提示。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE DramaCanvasRun r SET r.refsJson = :refs WHERE r.id = :id AND r.status IN ('queued', 'running')")
    int setRefsIfActive(@Param("id") String id, @Param("refs") String refs);
}
