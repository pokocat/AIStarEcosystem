package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.CreditGrant;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface CreditGrantRepository extends JpaRepository<CreditGrant,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from CreditGrant x where x.id=:id")
    Optional<CreditGrant> lockById(@Param("id") String id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from CreditGrant g where g.source=:source and g.sourceReference=:reference")
    Optional<CreditGrant> lockBySourceAndSourceReference(@Param("source") String source, @Param("reference") String reference);
    List<CreditGrant> findByWalletIdOrderByExpiresAtAscIdAsc(String walletId);
    /** Spendable lots only. Callers hold the wallet lock, which serializes every change to this wallet's lots. */
    @Query("select g from CreditGrant g where g.walletId=:wallet and g.available>0 and g.expiresAt>:now order by g.expiresAt, g.id")
    List<CreditGrant> findSpendable(@Param("wallet") String wallet, @Param("now") Instant now);
    org.springframework.data.domain.Page<CreditGrant> findByWalletId(String walletId,org.springframework.data.domain.Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from CreditGrant g where g.walletId=:wallet and g.campaignId=:campaign")
    List<CreditGrant> lockIssuedToWallet(@Param("wallet") String wallet, @Param("campaign") String campaign);
    @Query("select distinct g.walletId from CreditGrant g where g.expiresAt<=:now and g.available>0")
    List<String> expiredWallets(@Param("now") Instant now, org.springframework.data.domain.Pageable page);
}
