package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ReconciliationReportDto;
import com.aistareco.aep.service.ReconciliationService;
import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 对账视图（v2 §9 资金面 lane / §11）。只读重算 —— 现金勾稽 + 积分负债单列 + drift 告警。
 * 资金面动作 → 限 FINANCE_ADMIN / SUPER_ADMIN（一线运营不进资金面对账）。
 */
@RestController
@RequestMapping("/api/admin/finance/reconciliation")
public class AdminReconciliationController {

    private final ReconciliationService reconciliationService;

    public AdminReconciliationController(ReconciliationService reconciliationService) {
        this.reconciliationService = reconciliationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<ReconciliationReportDto> report() {
        return ApiResponse.of(reconciliationService.compute());
    }
}
