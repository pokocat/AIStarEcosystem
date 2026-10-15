package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseLifecycleOperation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface EnterpriseLifecycleOperationRepository extends JpaRepository<EnterpriseLifecycleOperation,String> {
    Optional<EnterpriseLifecycleOperation> findByEnterpriseIdAndClientRequestId(String enterpriseId,String clientRequestId);
}
