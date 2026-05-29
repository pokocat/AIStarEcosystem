package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialScript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialScriptRepository extends JpaRepository<MaterialScript, String> {
    List<MaterialScript> findAllByOrderByOrdAsc();

    /**
     * 可见范围：共享脚本（owner_user_id IS NULL）+ 当前用户私有脚本。
     * uid 为 null 时 `= :uid` 恒 false，自动只返回共享脚本。
     */
    @Query("SELECT s FROM MaterialScript s WHERE s.deletedAt IS NULL AND (s.ownerUserId IS NULL OR s.ownerUserId = :uid) ORDER BY s.ord ASC")
    List<MaterialScript> findVisibleTo(@Param("uid") String uid);
}
