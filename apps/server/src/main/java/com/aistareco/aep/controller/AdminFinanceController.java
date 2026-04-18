package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MonthlyRevenuePointDto;
import com.aistareco.aep.dto.RevenueSourceDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/finance")
public class AdminFinanceController {

    @GetMapping("/transactions")
    public ApiResponse<List<TransactionDto>> transactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId) {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/revenue/monthly")
    public ApiResponse<List<MonthlyRevenuePointDto>> monthlyRevenue() {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/revenue/sources")
    public ApiResponse<List<RevenueSourceDto>> revenueSources() {
        return ApiResponse.of(List.of());
    }
}
