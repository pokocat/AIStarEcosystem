package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialVideoRepository extends JpaRepository<MaterialVideo, String> {
    List<MaterialVideo> findAllByOrderByOrdAsc();
    List<MaterialVideo> findByProductIdOrderByOrdAsc(String productId);

    /** 可见范围：共享视频（owner_user_id IS NULL）+ 当前用户生成的视频。 */
    @Query("SELECT v FROM MaterialVideo v WHERE v.ownerUserId IS NULL OR v.ownerUserId = :uid ORDER BY v.ord ASC")
    List<MaterialVideo> findVisibleTo(@Param("uid") String uid);

    @Query("SELECT v FROM MaterialVideo v WHERE v.productId = :pid AND (v.ownerUserId IS NULL OR v.ownerUserId = :uid) ORDER BY v.ord ASC")
    List<MaterialVideo> findVisibleToByProduct(@Param("uid") String uid, @Param("pid") String pid);
}
