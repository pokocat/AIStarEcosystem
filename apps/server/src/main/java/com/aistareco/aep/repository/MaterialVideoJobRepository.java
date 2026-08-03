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

    long countByStatus(String status);

    long countByStatusIn(java.util.Collection<String> statuses);

    long countByOwnerUserIdAndStatus(String ownerUserId, String status);

    long countByOwnerUserIdAndStatusIn(String ownerUserId, java.util.Collection<String> statuses);

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
