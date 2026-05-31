package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaPublishJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaPublishJobRepository extends JpaRepository<DramaPublishJob, String> {

    List<DramaPublishJob> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    List<DramaPublishJob> findByOwnerUserIdAndProjectIdOrderByCreatedAtDesc(String ownerUserId, String projectId);

    Optional<DramaPublishJob> findByIdAndOwnerUserId(String id, String ownerUserId);
}
