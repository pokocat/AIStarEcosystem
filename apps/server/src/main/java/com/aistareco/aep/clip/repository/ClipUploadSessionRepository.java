package com.aistareco.aep.clip.repository;

import com.aistareco.aep.clip.model.ClipUploadSession;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ClipUploadSessionRepository extends JpaRepository<ClipUploadSession, String> {
    Optional<ClipUploadSession> findByExternalOwnerIdAndClientRequestId(String owner, String clientRequestId);
    Optional<ClipUploadSession> findByIdAndExternalOwnerId(String id, String owner);
}
