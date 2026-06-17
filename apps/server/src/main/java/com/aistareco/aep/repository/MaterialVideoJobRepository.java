package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialVideoJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialVideoJobRepository extends JpaRepository<MaterialVideoJob, String> {

    List<MaterialVideoJob> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    List<MaterialVideoJob> findByOwnerUserIdAndScriptIdOrderByCreatedAtDesc(String ownerUserId, String scriptId);

    List<MaterialVideoJob> findByOwnerUserIdAndProductIdOrderByCreatedAtDesc(String ownerUserId, String productId);

    long countByStatus(String status);

    long countByStatusIn(java.util.Collection<String> statuses);

    long countByOwnerUserIdAndStatus(String ownerUserId, String status);

    long countByOwnerUserIdAndStatusIn(String ownerUserId, java.util.Collection<String> statuses);
}
