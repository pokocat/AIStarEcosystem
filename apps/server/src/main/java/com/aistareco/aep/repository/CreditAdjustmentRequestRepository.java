package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditAdjustmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CreditAdjustmentRequestRepository extends JpaRepository<CreditAdjustmentRequest, String> {

    /** 审批队列：按状态列出（最新在前）。 */
    List<CreditAdjustmentRequest> findByStatusOrderByCreatedAtDesc(CreditAdjustmentRequest.Status status);

    /** 全部（最新在前）。 */
    List<CreditAdjustmentRequest> findAllByOrderByCreatedAtDesc();
}
