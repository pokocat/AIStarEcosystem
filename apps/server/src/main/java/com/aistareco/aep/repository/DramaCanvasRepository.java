package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaCanvas;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * 短剧画布（v0.198）。写文档只走 {@link #updateDocIfVersion}（条件更新），删只走 {@link #softDelete}：
 * 两者都只改自己那几列，不用 {@code save(entity)} 整行写回 —— 整行写回会把「读出来那一刻」的旧文档盖回去。
 *
 * <p>JPQL 放成常量：{@code @Query} 写错只会在 Spring 上下文启动时炸（整个 API 起不来），
 * {@code DramaCanvasSchemaTest} 拿同一个常量在 H2 上真跑一遍，提交前就能抓住。
 */
public interface DramaCanvasRepository extends JpaRepository<DramaCanvas, String> {

    String UPDATE_DOC_IF_VERSION = "UPDATE DramaCanvas c SET c.docJson = :docJson, c.docVersion = :docVersion, "
            + "c.title = :title, c.updatedAt = :updatedAt "
            + "WHERE c.id = :id AND c.ownerUserId = :ownerUserId AND c.deletedAt IS NULL "
            + "AND c.docVersion = :baseDocVersion";

    String SOFT_DELETE = "UPDATE DramaCanvas c SET c.deletedAt = :now, c.updatedAt = :now "
            + "WHERE c.id = :id AND c.ownerUserId = :ownerUserId AND c.deletedAt IS NULL";

    List<DramaCanvas> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaCanvas> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /**
     * 条件保存：只有库里还是 {@code baseDocVersion} 那一版时才写，返回影响行数（0 = 被别处抢先改过 / 刚删了 → 409）。
     *
     * <p>为什么不「读版本、比对、再 save」：两个标签页同时自动保存时，两边都能读到同一个旧版本、都通过比对，
     * 后到的那次把先到的整份文档盖掉，先到的那边还以为自己存上了。让数据库来判，只有一个能赢。
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(UPDATE_DOC_IF_VERSION)
    int updateDocIfVersion(@Param("id") String id,
                           @Param("ownerUserId") String ownerUserId,
                           @Param("baseDocVersion") String baseDocVersion,
                           @Param("docJson") String docJson,
                           @Param("docVersion") String docVersion,
                           @Param("title") String title,
                           @Param("updatedAt") OffsetDateTime updatedAt);

    /** 软删：只打 deletedAt（运行记录保留，已花的积分不退）。 */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(SOFT_DELETE)
    int softDelete(@Param("id") String id,
                   @Param("ownerUserId") String ownerUserId,
                   @Param("now") OffsetDateTime now);
}
