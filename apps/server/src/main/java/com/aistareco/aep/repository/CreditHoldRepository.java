package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditHold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface CreditHoldRepository extends JpaRepository<CreditHold, String> {

    /**
     * 幂等查询：referenceType + referenceId 是 unique key。
     * 同一业务对象的 hold 唯一存在；ACTIVE / COMMITTED / RELEASED 三态下均能查到。
     */
    Optional<CreditHold> findByReferenceTypeAndReferenceId(String referenceType, String referenceId);

    /** 孤儿 hold 清扫：某状态下早于 cutoff 创建的 hold（sweeper 用，v2 §5 P0）。 */
    List<CreditHold> findByStatusAndCreatedAtBefore(CreditHold.Status status, Instant cutoff);
}
