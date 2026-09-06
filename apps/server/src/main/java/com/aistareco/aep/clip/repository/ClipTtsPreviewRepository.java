package com.aistareco.aep.clip.repository;

import com.aistareco.aep.clip.model.ClipTtsPreview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ClipTtsPreviewRepository extends JpaRepository<ClipTtsPreview, String> {
    Optional<ClipTtsPreview> findByExternalOwnerIdAndProjectId(String owner, String projectId);
    List<ClipTtsPreview> findByExternalOwnerId(String owner);
    List<ClipTtsPreview> findByProjectId(String projectId);
    List<ClipTtsPreview> findTop20ByStatusOrderByCreatedAtAsc(String status);
    List<ClipTtsPreview> findTop100ByStatusInAndHeartbeatAtBefore(Collection<String> statuses, Instant cutoff);

    /** 与 ClipRenderJobRepository.acquire 同一套租约口径：多实例下只有一台能推进同一行。 */
    @Modifying
    @Query("update ClipTtsPreview p set p.leaseOwner=:owner, p.leaseUntil=:until, p.heartbeatAt=:now, p.updatedAt=:now " +
            "where p.id=:id and p.status='generating' and (p.leaseUntil is null or p.leaseUntil < :now)")
    int acquire(@Param("id") String id, @Param("owner") String owner, @Param("until") Instant until,
                @Param("now") Instant now);
}
