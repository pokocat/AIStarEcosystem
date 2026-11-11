package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseLifecycleOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface EnterpriseLifecycleOperationRepository extends JpaRepository<EnterpriseLifecycleOperation,String> {
    @org.springframework.data.jpa.repository.Query("select x from EnterpriseLifecycleOperation x where x.enterpriseId = ?1 and trim(trailing from x.clientRequestId) = trim(trailing from ?2)")
    Optional<EnterpriseLifecycleOperation> findByEnterpriseIdAndClientRequestId(String enterpriseId,String clientRequestId);
}
