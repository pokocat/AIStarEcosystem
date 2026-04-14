package com.aistareco.aep.repository;

import com.aistareco.aep.model.Plan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PlanRepository extends JpaRepository<Plan, String>,
        PagingAndSortingRepository<Plan, String> {

    List<Plan> findByProductId(String productId);

    Page<Plan> findByProductId(String productId, Pageable pageable);

    boolean existsByProductIdAndCode(String productId, String code);
}
