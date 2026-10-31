package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.CreditResourceReservation;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface CreditResourceReservationRepository extends JpaRepository<CreditResourceReservation,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from CreditResourceReservation x where x.id=:id")
    Optional<CreditResourceReservation> lockById(@Param("id") String id);
    List<CreditResourceReservation> findByHoldIdOrderByCampaignIdAsc(String holdId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CreditResourceReservation r where r.campaignId=:campaign and r.walletId=:wallet and (r.createdAt>=:since or r.completedAt is null) order by r.id")
    List<CreditResourceReservation> lockUsage(@Param("campaign") String campaign, @Param("wallet") String wallet, @Param("since") Instant since);
    @Query("select r from CreditResourceReservation r where r.campaignId=:campaign and r.walletId=:wallet and (r.createdAt>=:since or r.completedAt is null) order by r.id")
    List<CreditResourceReservation> previewUsage(@Param("campaign") String campaign, @Param("wallet") String wallet, @Param("since") Instant since);
}
