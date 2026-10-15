package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseAudit;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseAuditRepository extends JpaRepository<EnterpriseAudit,String> {
    Page<EnterpriseAudit> findByEnterpriseIdOrderByCreatedAtDesc(String enterpriseId,Pageable pageable);
}
