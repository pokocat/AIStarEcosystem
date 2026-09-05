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
    List<EntitlementGrant> findBySourceAndSourceReference(EnrollmentSource source, String sourceReference);

    Optional<EntitlementGrant> findBySourceAndSourceReferenceAndProduct(
            EnrollmentSource source, String sourceReference, String product);

    List<EntitlementGrant> findByUserIdOrderByGrantedAtAsc(String userId);

    long countBySourceAndSourceReference(EnrollmentSource source, String sourceReference);
}
