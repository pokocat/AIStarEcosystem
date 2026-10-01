package com.aistareco.aep.repository;

import com.aistareco.aep.model.StorageAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
