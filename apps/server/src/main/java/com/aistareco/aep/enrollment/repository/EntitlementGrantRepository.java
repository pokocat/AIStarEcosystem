package com.aistareco.aep.enrollment.repository;

import com.aistareco.aep.enrollment.model.EntitlementGrant;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntitlementGrantRepository extends JpaRepository<EntitlementGrant, String> {

    /** 一把激活码可能对多个子产品各留一行（v0.150 起 UNIQUE 是三元组）。 */
    @org.springframework.data.jpa.repository.Query("select x from EntitlementGrant x where x.source = ?1 and trim(trailing from x.sourceReference) = trim(trailing from ?2)")
    List<EntitlementGrant> findBySourceAndSourceReference(EnrollmentSource source, String sourceReference);

    @org.springframework.data.jpa.repository.Query("select x from EntitlementGrant x where x.source = ?1 and trim(trailing from x.sourceReference) = trim(trailing from ?2) and x.product = ?3")
    Optional<EntitlementGrant> findBySourceAndSourceReferenceAndProduct(
            EnrollmentSource source, String sourceReference, String product);

    List<EntitlementGrant> findByUserIdOrderByGrantedAtAsc(String userId);

    @org.springframework.data.jpa.repository.Query("select count(x) from EntitlementGrant x where x.source = ?1 and trim(trailing from x.sourceReference) = trim(trailing from ?2)")
    long countBySourceAndSourceReference(EnrollmentSource source, String sourceReference);
}
