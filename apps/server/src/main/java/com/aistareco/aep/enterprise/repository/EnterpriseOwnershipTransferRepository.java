package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseOwnershipTransfer;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseOwnershipTransferRepository extends JpaRepository<EnterpriseOwnershipTransfer,String> {
    Page<EnterpriseOwnershipTransfer> findByEnterpriseIdOrderByExpiresAtDesc(String enterpriseId,Pageable pageable);
    @org.springframework.data.jpa.repository.Query("select x from EnterpriseOwnershipTransfer x where x.enterpriseId = ?1 and x.fromUserId = ?2 and trim(trailing from x.clientRequestId) = trim(trailing from ?3)")
    Optional<EnterpriseOwnershipTransfer> findByEnterpriseIdAndFromUserIdAndClientRequestId(String enterpriseId,String fromUserId,String clientRequestId);
}
