package com.aistareco.aep.repository;

import com.aistareco.aep.model.Membership;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, String>,
        PagingAndSortingRepository<Membership, String> {

    List<Membership> findByTenantId(String tenantId);

    List<Membership> findByUserId(String userId);

    Page<Membership> findByTenantId(String tenantId, Pageable pageable);
}
