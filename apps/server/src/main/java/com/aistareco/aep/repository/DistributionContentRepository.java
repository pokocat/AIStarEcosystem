package com.aistareco.aep.repository;

import com.aistareco.aep.model.DistributionContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DistributionContentRepository extends JpaRepository<DistributionContent, String> {
}
