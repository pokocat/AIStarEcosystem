package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapComposition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapCompositionRepository extends JpaRepository<DapComposition, String> {
    List<DapComposition> findTop50ByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId);
    List<DapComposition> findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId, String ipId);
    Optional<DapComposition> findByIdAndOwnerUserId(String id, String ownerUserId);
    Optional<DapComposition> findByJobIdAndOwnerUserId(String jobId, String ownerUserId);
    Optional<DapComposition> findFirstByJobId(String jobId);
}
