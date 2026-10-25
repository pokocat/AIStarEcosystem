package com.aistareco.aep.billing.repository;

import com.aistareco.aep.billing.model.ModelCharge;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
import java.math.BigDecimal;

public interface ModelChargeRepository extends JpaRepository<ModelCharge,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select x from ModelCharge x where x.holdId=:id")
    Optional<ModelCharge> lockById(@Param("id") String id);

    java.util.List<ModelCharge> findByParentHoldIdOrderByCreatedAtAscHoldIdAsc(String parentHoldId);

    interface Amounts {
        long getScopedCredits();
        long getWalletCredits();
        long getSettledScopedCredits();
        long getSettledWalletCredits();
        com.aistareco.aep.model.CreditHold.Status getHoldStatus();
    }
    @Query("select c.scopedCredits as scopedCredits,c.walletCredits as walletCredits,"
            +"c.settledScopedCredits as settledScopedCredits,c.settledWalletCredits as settledWalletCredits,h.status as holdStatus "
            +"from ModelCharge c join CreditHold h on h.id=c.holdId where h.referenceType=:type and h.referenceId in :ids")
    List<Amounts> amountsForReferences(@Param("type") String type,@Param("ids") Collection<String> ids);

}
