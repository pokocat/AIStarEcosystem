package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.ModelDiscount;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface ModelDiscountRepository extends JpaRepository<ModelDiscount,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from ModelDiscount x where x.id=:id")
    Optional<ModelDiscount> lockById(@Param("id") String id);
    List<ModelDiscount> findByTargetKeyAndActiveTrueOrderByIdAsc(String targetKey);
}
