package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseOwnershipTransfer;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseOwnershipTransferRepository extends JpaRepository<EnterpriseOwnershipTransfer,String> {
    Page<EnterpriseOwnershipTransfer> findByEnterpriseIdOrderByExpiresAtDesc(String enterpriseId,Pageable pageable);
    Optional<EnterpriseOwnershipTransfer> findByEnterpriseIdAndFromUserIdAndClientRequestId(String enterpriseId,String fromUserId,String clientRequestId);
}
