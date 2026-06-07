package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface DapJobRepository extends JpaRepository<DapJob, String> {
    List<DapJob> findTop50ByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
    List<DapJob> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(String ownerUserId, String status);
    List<DapJob> findByOwnerUserIdAndAvatarIdOrderByCreatedAtDesc(String ownerUserId, String avatarId);
    Optional<DapJob> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndStatusAndFinishedAtAfter(String ownerUserId, String status, Instant after);
    @Query("SELECT COALESCE(SUM(j.cost),0) FROM DapJob j WHERE j.ownerUserId = :uid AND j.createdAt >= :since AND j.status <> 'failed'")
    long sumCostSince(@Param("uid") String uid, @Param("since") Instant since);
    List<DapJob> findByAvatarId(String avatarId);
}
