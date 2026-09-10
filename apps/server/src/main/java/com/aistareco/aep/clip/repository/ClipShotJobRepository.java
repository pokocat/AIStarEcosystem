package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipShotJob;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;
public interface ClipShotJobRepository extends JpaRepository<ClipShotJob, String> {
    Optional<ClipShotJob> findByExternalOwnerIdAndClientRequestId(String owner, String requestId);
    /** 一镜可以重生成很多次，端上只关心最新那一单 —— GET generation / cancel 都以它为准。 */
    Optional<ClipShotJob> findFirstByExternalOwnerIdAndProjectIdAndShotNoOrderByCreatedAtDesc(String owner, String projectId, int shotNo);
    Optional<ClipShotJob> findFirstByExternalOwnerIdAndProjectIdAndShotNoAndFingerprintAndStatusOrderByCreatedAtDesc(
            String owner, String projectId, int shotNo, String fingerprint, String status);
    List<ClipShotJob> findByProjectId(String projectId);
    List<ClipShotJob> findTop20ByStatusInOrderByCreatedAtAsc(Collection<String> statuses);
    List<ClipShotJob> findTop100ByStatusInAndHeartbeatAtBefore(Collection<String> statuses, Instant cutoff);
    @Modifying
    @Query("update ClipShotJob j set j.leaseOwner=:owner, j.leaseUntil=:until, j.heartbeatAt=:now, j.updatedAt=:now " +
            "where j.id=:id and j.status in :statuses and (j.leaseUntil is null or j.leaseUntil < :now)")
    int acquire(@Param("id") String id, @Param("owner") String owner, @Param("until") Instant until,
                @Param("now") Instant now, @Param("statuses") Collection<String> statuses);
}
