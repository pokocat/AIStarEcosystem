package com.aistareco.aep.repository;

import com.aistareco.aep.model.StorageAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface StorageAssetRepository extends JpaRepository<StorageAsset, String> {

    boolean existsByCdnKey(String cdnKey);

    /**
     * 归属查询（2026-09-30 热修）：某用户在某子应用下记过账的资产里，key 落在这几个候选之一的。
     * 短剧首帧交给聚算 H3 之前用它证明「这张图是本人生成 / 上传的」（{@code DramaReferenceAssembler#ownedFrameKey}）。
     */
    List<StorageAsset> findByAppAndOwnerUserIdAndCdnKeyIn(String app, String ownerUserId,
                                                           java.util.Collection<String> cdnKeys);

    /** 某用户在某子应用的总占用字节（含回收站；软删不删本表行）。 */
    @Query("SELECT COALESCE(SUM(s.bytes),0) FROM StorageAsset s WHERE s.app = :app AND s.ownerUserId = :uid")
    long sumBytes(@Param("app") String app, @Param("uid") String uid);

    /** 分类明细：[category, sumBytes]。 */
    @Query("SELECT s.category, COALESCE(SUM(s.bytes),0) FROM StorageAsset s "
            + "WHERE s.app = :app AND s.ownerUserId = :uid GROUP BY s.category ORDER BY SUM(s.bytes) DESC")
    List<Object[]> sumBytesByCategory(@Param("app") String app, @Param("uid") String uid);

    /** 彻底删除某业务对象时释放其占用。 */
    void deleteByAppAndRefId(String app, String refId);

    // ── v0.198 短剧画布归属闸（DramaCanvasOwnership）─────────────────────────────

    String FIND_OWNED_CDN_KEYS =
            "SELECT s.cdnKey FROM StorageAsset s WHERE s.app = :app AND s.ownerUserId = :uid AND s.cdnKey IN :keys";

    /**
     * 这批 key 里哪些是「本人在该子应用下的资产」（生成 / 上传时记过的）。
     * 调用方负责分批（IN 列表别太长）并跳过空集合。
     */
    @Query(FIND_OWNED_CDN_KEYS)
    List<String> findOwnedCdnKeys(@Param("app") String app, @Param("uid") String uid,
                                  @Param("keys") Collection<String> keys);

    /** 按 key 找记录（通常 0 或 1 行；并发记账时可能多于 1 行）。 */
    List<StorageAsset> findByCdnKey(String cdnKey);
}
