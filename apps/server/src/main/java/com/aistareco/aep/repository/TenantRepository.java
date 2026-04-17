package com.aistareco.aep.repository;

import com.aistareco.aep.model.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, String>,
        PagingAndSortingRepository<Tenant, String> {

    Page<Tenant> findByStatus(Tenant.TenantStatus status, Pageable pageable);

    Page<Tenant> findByKind(Tenant.TenantKind kind, Pageable pageable);

    long countByStatus(Tenant.TenantStatus status);
}
