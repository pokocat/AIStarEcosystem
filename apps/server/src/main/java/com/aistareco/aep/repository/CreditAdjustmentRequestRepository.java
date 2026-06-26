package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditAdjustmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface CreditAdjustmentRequestRepository extends JpaRepository<CreditAdjustmentRequest, String> {

    /** 审批队列：按状态列出（最新在前）。 */
    List<CreditAdjustmentRequest> findByStatusOrderByCreatedAtDesc(CreditAdjustmentRequest.Status status);

    /** 全部（最新在前）。 */
    List<CreditAdjustmentRequest> findAllByOrderByCreatedAtDesc();

    /**
     * v2 §9.2 #5 per-actor 日限额：某发起人自 since 起、指定状态的调差/赠送积分累计。
     * 计入 APPROVED（已入账）+ PENDING_APPROVAL（待批，预占额度，防排队绕限），排除 REJECTED。
     */
    @Query("SELECT COALESCE(SUM(r.amount), 0) FROM CreditAdjustmentRequest r "
            + "WHERE r.makerId = :makerId AND r.createdAt >= :since AND r.status IN :statuses")
    long sumAmountByMakerSince(@Param("makerId") String makerId,
                              @Param("since") Instant since,
                              @Param("statuses") List<CreditAdjustmentRequest.Status> statuses);
}
