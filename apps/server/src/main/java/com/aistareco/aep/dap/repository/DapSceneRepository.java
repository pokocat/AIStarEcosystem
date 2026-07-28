package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapScene;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapSceneRepository extends JpaRepository<DapScene, String> {
    List<DapScene> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    List<DapScene> findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String ipId);
    Optional<DapScene> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndDeletedAtIsNull(String ownerUserId);
    long countByOwnerUserIdAndIpIdAndDeletedAtIsNull(String ownerUserId, String ipId);

    @Query("SELECT COALESCE(SUM(s.bytes),0) FROM DapScene s WHERE s.ownerUserId = :uid AND s.deletedAt IS NULL")
    long sumBytesByOwner(@Param("uid") String uid);
}
