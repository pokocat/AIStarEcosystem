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
    @org.springframework.data.jpa.repository.Query("select x from EnterpriseInvitation x where x.enterpriseId = ?1 and x.createdBy = ?2 and trim(trailing from x.clientRequestId) = trim(trailing from ?3)")
    Optional<EnterpriseInvitation> findByEnterpriseIdAndCreatedByAndClientRequestId(String enterpriseId,String createdBy,String clientRequestId);
}
