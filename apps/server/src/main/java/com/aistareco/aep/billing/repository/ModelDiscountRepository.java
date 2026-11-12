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
    @org.springframework.data.jpa.repository.Query("select x from ModelDiscount x where trim(trailing from x.targetKey)=trim(trailing from :targetKey) and x.active=true order by x.id asc")
    List<ModelDiscount> findByTargetKeyAndActiveTrueOrderByIdAsc(String targetKey);
}
