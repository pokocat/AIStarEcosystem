package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterpriseCreditLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Transactional
public interface EnterpriseCreditLotRepository extends JpaRepository<EnterpriseCreditLot,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<EnterpriseCreditLot> findByRechargeOrderIdAndWalletId(String rechargeOrderId,String walletId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<EnterpriseCreditLot> findByWalletIdOrderByCreatedAtAscIdAsc(String walletId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<EnterpriseCreditLot> findByRechargeOrderIdOrderByWalletIdAsc(String rechargeOrderId);
}
