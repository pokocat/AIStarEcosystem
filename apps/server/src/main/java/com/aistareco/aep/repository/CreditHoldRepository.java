package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditHold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CreditHoldRepository extends JpaRepository<CreditHold, String> {

    /**
     * 幂等查询：referenceType + referenceId 是 unique key。
     * 同一业务对象的 hold 唯一存在；ACTIVE / COMMITTED / RELEASED 三态下均能查到。
     */
    Optional<CreditHold> findByReferenceTypeAndReferenceId(String referenceType, String referenceId);
}
