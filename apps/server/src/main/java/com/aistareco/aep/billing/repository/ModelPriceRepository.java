package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.ModelPrice;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface ModelPriceRepository extends JpaRepository<ModelPrice,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from ModelPrice x where x.id=:id")
    Optional<ModelPrice> lockById(@Param("id") String id);
    @org.springframework.data.jpa.repository.Query("select x from ModelPrice x where trim(trailing from x.targetKey) = trim(trailing from :targetKey)")
    Optional<ModelPrice> findByTargetKey(@org.springframework.data.repository.query.Param("targetKey") String targetKey);
}
