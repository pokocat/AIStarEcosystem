package com.aistareco.aep.repository;

import com.aistareco.aep.model.DistributionQueueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DistributionQueueItemRepository extends JpaRepository<DistributionQueueItem, String> {
}
