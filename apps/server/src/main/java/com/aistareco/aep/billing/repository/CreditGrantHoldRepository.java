package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.CreditGrantHold;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface CreditGrantHoldRepository extends JpaRepository<CreditGrantHold,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from CreditGrantHold x where x.id=:id")
    Optional<CreditGrantHold> lockById(@Param("id") String id);
    List<CreditGrantHold> findByHoldIdOrderByAllocationOrderAsc(String holdId);
}
