package com.aistareco.aep.repository;

import com.aistareco.aep.model.StorageAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StorageAssetRepository extends JpaRepository<StorageAsset, String> {

    boolean existsByCdnKey(String cdnKey);

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
