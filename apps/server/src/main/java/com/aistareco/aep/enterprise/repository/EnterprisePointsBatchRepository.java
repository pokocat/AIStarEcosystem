package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterprisePointsBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EnterprisePointsBatchRepository extends JpaRepository<EnterprisePointsBatch,String> {
    @org.springframework.data.jpa.repository.Query("select x from EnterprisePointsBatch x where x.enterpriseId = ?1 and trim(trailing from x.clientRequestId) = trim(trailing from ?2)")
    Optional<EnterprisePointsBatch> findByEnterpriseIdAndClientRequestId(String enterpriseId, String clientRequestId);
}
