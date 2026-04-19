package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MonthlyRevenuePointDto;
import com.aistareco.aep.dto.RevenueSourceDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.aep.service.AdminFinanceService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 平台级财务视图。基于 LedgerEntry 事实表聚合出业务交易列表、月度入账趋势、
 * 入账来源饼图三种只读视图，对齐前端 {@code apps/admin/src/api/finance.ts}。
 */
@RestController
@RequestMapping("/api/admin/finance")
public class AdminFinanceController {

    private final AdminFinanceService financeService;

    public AdminFinanceController(AdminFinanceService financeService) {
        this.financeService = financeService;
    }

    @GetMapping("/transactions")
    public ApiResponse<List<TransactionDto>> transactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId) {
        return ApiResponse.of(financeService.listTransactions(page, size, userId));
    }

    @GetMapping("/revenue/monthly")
    public ApiResponse<List<MonthlyRevenuePointDto>> monthlyRevenue() {
        return ApiResponse.of(financeService.monthlyRevenue());
    }

    @GetMapping("/revenue/sources")
    public ApiResponse<List<RevenueSourceDto>> revenueSources() {
        return ApiResponse.of(financeService.revenueSources());
    }
}
