package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipRenderJob;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface ClipRenderJobRepository extends JpaRepository<ClipRenderJob, String> {
    Optional<ClipRenderJob> findByIdAndExternalOwnerId(String id, String owner);
    Optional<ClipRenderJob> findByExternalOwnerIdAndClientRequestId(String owner, String requestId);
    List<ClipRenderJob> findTop20ByStatusInOrderByCreatedAtAsc(Collection<String> statuses);
    List<ClipRenderJob> findTop100ByStatusInAndHeartbeatAtBefore(Collection<String> statuses, Instant cutoff);
    Optional<ClipRenderJob> findFirstByProjectIdAndStatusOrderByCreatedAtDesc(String projectId, String status);
    Optional<ClipRenderJob> findFirstByProjectIdAndExternalOwnerIdOrderByCreatedAtDesc(String projectId, String owner);
    List<ClipRenderJob> findByProjectId(String projectId);
    List<ClipRenderJob> findTop50ByExternalOwnerIdAndStatusInOrderByCreatedAtDesc(String owner, Collection<String> statuses);
    @Modifying
    @Query("update ClipRenderJob j set j.leaseOwner=:owner, j.leaseUntil=:until, j.heartbeatAt=:now, j.updatedAt=:now " +
            "where j.id=:id and j.status in :statuses and (j.leaseUntil is null or j.leaseUntil < :now)")
    int acquire(@Param("id") String id, @Param("owner") String owner, @Param("until") Instant until,
                @Param("now") Instant now, @Param("statuses") Collection<String> statuses);
}
