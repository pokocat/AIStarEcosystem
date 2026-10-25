package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditAdjustmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface CreditAdjustmentRequestRepository extends JpaRepository<CreditAdjustmentRequest, String> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CreditAdjustmentRequest r where r.id=:id")
    java.util.Optional<CreditAdjustmentRequest> lockById(@Param("id") String id);

    /** 审批队列：按状态列出（最新在前）。 */
    List<CreditAdjustmentRequest> findByStatusOrderByCreatedAtDesc(CreditAdjustmentRequest.Status status);

    /** Approved ordinary gifts/compensations since a time, used to find customers whose credits may be converted to model grants. */
    List<CreditAdjustmentRequest> findByTypeInAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
            java.util.Collection<CreditAdjustmentRequest.Type> types, CreditAdjustmentRequest.Status status, java.time.Instant since);

    /** 全部（最新在前）。 */
    List<CreditAdjustmentRequest> findAllByOrderByCreatedAtDesc();

    /**
     * v2 §9.2 #5 per-actor 日限额：某发起人自 since 起、指定状态的调差/赠送积分累计。
     * 计入 APPROVED（已入账）+ PENDING_APPROVAL（待批，预占额度，防排队绕限），排除 REJECTED。
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM CreditAdjustmentRequest r "
            + "WHERE r.makerId = :makerId AND r.createdAt >= :since AND r.status IN :statuses")
    List<CreditAdjustmentRequest> lockByMakerSince(@Param("makerId") String makerId,
                              @Param("since") Instant since,
                              @Param("statuses") List<CreditAdjustmentRequest.Status> statuses);
}
