package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipProject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
import java.time.Instant;
public interface ClipProjectRepository extends JpaRepository<ClipProject, String> {
    Optional<ClipProject> findByIdAndExternalOwnerIdAndDeletedAtIsNull(String id, String owner);
    List<ClipProject> findByExternalOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String owner);
    Optional<ClipProject> findFirstByExternalOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(String owner, String status);
    List<ClipProject> findTop100ByDeletedAtBeforeOrderByDeletedAtAsc(Instant cutoff);
}
