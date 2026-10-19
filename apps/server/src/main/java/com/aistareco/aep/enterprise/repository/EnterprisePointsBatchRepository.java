package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterprisePointsBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EnterprisePointsBatchRepository extends JpaRepository<EnterprisePointsBatch,String> {
    Optional<EnterprisePointsBatch> findByEnterpriseIdAndClientRequestId(String enterpriseId, String clientRequestId);
}
