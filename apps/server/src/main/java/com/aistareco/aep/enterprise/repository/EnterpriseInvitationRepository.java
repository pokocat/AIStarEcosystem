package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseInvitation;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseInvitationRepository extends JpaRepository<EnterpriseInvitation,String> {
    Page<EnterpriseInvitation> findByEnterpriseIdOrderByCreatedAtDesc(String enterpriseId,Pageable pageable);
    Optional<EnterpriseInvitation> findByTokenHash(String tokenHash);
    Optional<EnterpriseInvitation> findByEnterpriseIdAndCreatedByAndClientRequestId(String enterpriseId,String createdBy,String clientRequestId);
}
