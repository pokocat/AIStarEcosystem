package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaFrameJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface DramaFrameJobRepository extends JpaRepository<DramaFrameJob, String> {

    List<DramaFrameJob> findTop50ByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    List<DramaFrameJob> findTop50ByOwnerUserIdAndProjectIdOrderByCreatedAtDesc(String ownerUserId, String projectId);

    long countByStatus(String status);

    long countByStatusIn(Collection<String> statuses);

    long countByOwnerUserIdAndStatus(String ownerUserId, String status);

    long countByOwnerUserIdAndStatusIn(String ownerUserId, Collection<String> statuses);
}
