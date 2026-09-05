package com.aistareco.aep.enrollment.repository;

import com.aistareco.aep.enrollment.model.ProductEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductEnrollmentRepository extends JpaRepository<ProductEnrollment, String> {

    List<ProductEnrollment> findByUserIdOrderByProductAsc(String userId);

    Optional<ProductEnrollment> findByUserIdAndProduct(String userId, String product);

    boolean existsByUserId(String userId);

    /** 回填 runner 批量判定「哪些账号已经有行」，避免逐个 exists 查询。 */
    @org.springframework.data.jpa.repository.Query(
            "select distinct e.userId from ProductEnrollment e where e.userId in :userIds")
    List<String> findUserIdsIn(@org.springframework.data.repository.query.Param("userIds") Collection<String> userIds);
}
