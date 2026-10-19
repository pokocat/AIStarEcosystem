package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterpriseBillingAuthorization;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface EnterpriseBillingAuthorizationRepository extends JpaRepository<EnterpriseBillingAuthorization,String> {
    Optional<EnterpriseBillingAuthorization> findByReferenceTypeAndReferenceId(String referenceType,String referenceId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from EnterpriseBillingAuthorization a where a.referenceType=:type and a.referenceId=:ref")
    Optional<EnterpriseBillingAuthorization> lockByReference(@Param("type")String type,@Param("ref")String ref);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from EnterpriseBillingAuthorization a where a.enterpriseId=:enterprise and a.terminalAt is null order by a.id")
    List<EnterpriseBillingAuthorization> activeInEnterprise(@Param("enterprise")String enterprise);
    Page<EnterpriseBillingAuthorization> findByEnterpriseIdOrderByCreatedAtDesc(String enterpriseId,Pageable page);
    Page<EnterpriseBillingAuthorization> findByEnterpriseIdAndActorUserIdOrderByCreatedAtDesc(String enterpriseId,String actorUserId,Pageable page);
}
