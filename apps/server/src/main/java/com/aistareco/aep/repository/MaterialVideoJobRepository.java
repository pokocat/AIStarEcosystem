package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialVideoJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface MaterialVideoJobRepository extends JpaRepository<MaterialVideoJob, String> {

    /**
     * 行的子产品分区表达式：app 列为真值；老数据（回填前 app 为 null）按 kind 前缀推断
     * （drama-shot / drama-episode → drama，其余 → celebrity）。与
     * {@code MaterialVideoJobService.appOf} 同一套判定，故列表不依赖回填是否已跑。
     */
    String APP_EXPR = "(case when j.app is not null then j.app "
            + "when j.kind like 'drama-%' then 'drama' else 'celebrity' end)";

    // 列表一律按 app 分区（带货 celebrity / 短剧 drama）—— 本表被两条业务线共用，
    // 不带 app 的查询会让 A 应用看到 B 应用的视频资产。
    @Query("select j from MaterialVideoJob j where j.ownerUserId = :userId and " + APP_EXPR + " = :app "
            + "order by j.createdAt desc")
    List<MaterialVideoJob> findScoped(@Param("userId") String userId, @Param("app") String app);

    @Query("select j from MaterialVideoJob j where j.ownerUserId = :userId and " + APP_EXPR + " = :app "
            + "and j.scriptId = :scriptId order by j.createdAt desc")
    List<MaterialVideoJob> findScopedByScript(@Param("userId") String userId, @Param("app") String app,
                                              @Param("scriptId") String scriptId);

    @Query("select j from MaterialVideoJob j where j.ownerUserId = :userId and " + APP_EXPR + " = :app "
            + "and j.productId = :productId order by j.createdAt desc")
    List<MaterialVideoJob> findScopedByProduct(@Param("userId") String userId, @Param("app") String app,
                                               @Param("productId") String productId);

    /**
     * 归属查询（2026-09-30 热修）：本人在某分区下、真实末帧 key 落在这几个候选之一的任务。
     * 短剧承接上一镜末帧作首帧时，末帧不进存储台账（只记在任务行上），靠它证明归属。
     */
    @Query("select j from MaterialVideoJob j where j.ownerUserId = :userId and " + APP_EXPR + " = :app "
            + "and j.lastFrameCdnKey in :keys")
    List<MaterialVideoJob> findScopedByLastFrameCdnKeyIn(@Param("userId") String userId, @Param("app") String app,
                                                         @Param("keys") java.util.Collection<String> keys);

    long countByStatus(String status);
    List<MaterialVideoJob> findByStatusIn(java.util.Collection<String> statuses);

    long countByStatusIn(java.util.Collection<String> statuses);

    long countByOwnerUserIdAndStatus(String ownerUserId, String status);

    long countByOwnerUserIdAndStatusIn(String ownerUserId, java.util.Collection<String> statuses);

    /**
     * v0.198 worker 条件认领：只有还在 queued 的任务才改成 submitting（影响 1 行才继续提交）。
     * 与 {@link #failIfQueued}（排队中取消 / 超时）互斥 —— 两边同时动手，数据库只让一个成功，
     * 取消了的任务不会再被交给厂商。
     */
    String CLAIM_QUEUED = "update MaterialVideoJob j set j.status = 'submitting', j.progress = 5, j.updatedAt = :now "
            + "where j.id = :id and j.status = 'queued'";

    /** 只把「还在 queued、从没交给厂商」的任务置 failed；返回影响行数（0 = 已经开始 / 不是本人的）。 */
    String FAIL_IF_QUEUED = "update MaterialVideoJob j set j.status = 'failed', j.errorMessage = :message, "
            + "j.completedAt = :now, j.updatedAt = :now "
            + "where j.id = :id and j.ownerUserId = :userId and j.status = 'queued' "
            + "and (j.externalTaskId is null or j.externalTaskId = '')";

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(CLAIM_QUEUED)
    int claimQueued(@Param("id") String id, @Param("now") java.time.OffsetDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(FAIL_IF_QUEUED)
    int failIfQueued(@Param("id") String id, @Param("userId") String userId, @Param("message") String message,
                     @Param("now") java.time.OffsetDateTime now);

    /**
     * v0.199.1 补封面：已成功、成片还在、但没有封面的任务（按 kind 前缀限定分区），新完成的排前面。
     * 见 {@code MaterialVideoCoverBackfill}。
     */
    @Query("select j from MaterialVideoJob j where j.status = 'succeeded' and j.thumbnailUrl is null "
            + "and j.videoUrl is not null and j.kind like concat(:kindPrefix, '%') order by j.completedAt desc")
    List<MaterialVideoJob> findCoverless(@Param("kindPrefix") String kindPrefix,
                                         org.springframework.data.domain.Pageable page);

    /**
     * 只在还没有封面时写入封面地址，返回影响行数（0 = 已经有了）。只动封面和更新时间两列：整行 save 会把
     * 同一时刻别处对这一行的改动盖掉。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update MaterialVideoJob j set j.thumbnailUrl = :url, j.updatedAt = :now "
            + "where j.id = :id and j.thumbnailUrl is null")
    int setThumbnailIfMissing(@Param("id") String id, @Param("url") String url,
                              @Param("now") java.time.OffsetDateTime now);

    /**
     * 老数据一次性回填 app（本列 v0.108 才加）：判定同 {@link #APP_EXPR}。
     * 幂等：只改 app is null 的行。回填只为让查询走 (owner_user_id, app) 索引，
     * 列表正确性不依赖它。
     */
    @Modifying
    @Transactional
    @Query("update MaterialVideoJob j set j.app = case when j.kind like 'drama-%' then 'drama' else 'celebrity' end "
            + "where j.app is null")
    int backfillAppFromKind();
}
