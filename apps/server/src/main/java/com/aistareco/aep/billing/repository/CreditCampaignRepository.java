package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.CreditCampaign;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface CreditCampaignRepository extends JpaRepository<CreditCampaign,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from CreditCampaign x where x.id=:id")
    Optional<CreditCampaign> lockById(@Param("id") String id);
    List<CreditCampaign> findByActiveTrueOrderByIdAsc();
    /** Scalar read: loading the entity before {@link #lockById} would trigger Hibernate's version-checked lock upgrade. */
    @Query("select x.expiresAt from CreditCampaign x where x.id=:id")
    Optional<java.time.Instant> expiryOf(@Param("id") String id);
    /**
     * IDs of resource-metered campaigns, read as scalars so no stale entity enters the persistence context before
     * {@link #lockById}: Hibernate version-checks an already-loaded @Version entity when upgrading its lock.
     */
    @Query("select x.id from CreditCampaign x where x.id in :ids and x.resourceUnit <> 'credit' order by x.id")
    List<String> meteredIds(@Param("ids") Collection<String> ids);
}
