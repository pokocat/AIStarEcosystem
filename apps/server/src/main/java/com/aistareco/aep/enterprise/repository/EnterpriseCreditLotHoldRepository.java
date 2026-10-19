package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterpriseCreditLotHold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Transactional
public interface EnterpriseCreditLotHoldRepository extends JpaRepository<EnterpriseCreditLotHold,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from EnterpriseCreditLotHold h join EnterpriseCreditLot l on l.id=h.lotId where h.holdId=:holdId order by l.createdAt,l.id,h.id")
    List<EnterpriseCreditLotHold> findByHoldIdOrderByIdAsc(@Param("holdId")String holdId);
}
