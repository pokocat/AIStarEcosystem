package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterpriseBillingAuthorization;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.*;

public interface EnterpriseBillingAuthorizationRepository extends JpaRepository<EnterpriseBillingAuthorization,String> {
    @org.springframework.data.jpa.repository.Query("select x from EnterpriseBillingAuthorization x where trim(trailing from x.referenceType) = trim(trailing from ?1) and trim(trailing from x.referenceId) = trim(trailing from ?2)")
    Optional<EnterpriseBillingAuthorization> findByReferenceTypeAndReferenceId(String referenceType,String referenceId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from EnterpriseBillingAuthorization a where trim(trailing from a.referenceType)=trim(trailing from :type) and trim(trailing from a.referenceId)=trim(trailing from :ref)")
    Optional<EnterpriseBillingAuthorization> lockByReference(@Param("type")String type,@Param("ref")String ref);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select a from EnterpriseBillingAuthorization a where a.enterpriseId=:enterprise and a.terminalAt is null order by a.id")
    List<EnterpriseBillingAuthorization> activeInEnterprise(@Param("enterprise")String enterprise);
    /** Advisory count for read-only quotes. MySQL rejects SELECT ... FOR UPDATE inside a read-only transaction. */
    @Query("select a from EnterpriseBillingAuthorization a where a.enterpriseId=:enterprise and a.actorUserId=:actor and a.terminalAt is null order by a.id")
    List<EnterpriseBillingAuthorization> activeForActorWithoutLock(@Param("enterprise")String enterprise,@Param("actor")String actor);
    Page<EnterpriseBillingAuthorization> findByEnterpriseIdOrderByCreatedAtDesc(String enterpriseId,Pageable page);
    Page<EnterpriseBillingAuthorization> findByEnterpriseIdAndActorUserIdOrderByCreatedAtDesc(String enterpriseId,String actorUserId,Pageable page);
}
