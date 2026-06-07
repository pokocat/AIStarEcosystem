package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapCapture;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DapCaptureRepository extends JpaRepository<DapCapture, String> {
    Optional<DapCapture> findByIdAndOwnerUserId(String id, String ownerUserId);
    Optional<DapCapture> findFirstByAvatarIdAndOwnerUserIdOrderByCreatedAtDesc(String avatarId, String ownerUserId);
    @Query("SELECT COALESCE(SUM(c.bytes),0) FROM DapCapture c WHERE c.ownerUserId = :uid")
    long sumBytesByOwner(@Param("uid") String uid);
    List<DapCapture> findByAvatarId(String avatarId);
}
