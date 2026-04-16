package com.aistareco.aep.repository;

import com.aistareco.aep.model.Entitlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EntitlementRepository extends JpaRepository<Entitlement, String>,
        PagingAndSortingRepository<Entitlement, String> {

    Page<Entitlement> findByTenantId(String tenantId, Pageable pageable);

    Page<Entitlement> findByProductId(String productId, Pageable pageable);

    Page<Entitlement> findByTenantIdAndProductId(String tenantId, String productId, Pageable pageable);

    List<Entitlement> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    List<Entitlement> findByTenantIdAndStatus(String tenantId, Entitlement.EntitlementStatus status);

    long countByStatus(Entitlement.EntitlementStatus status);
}
