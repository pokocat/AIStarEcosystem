package com.aistareco.aep.controller;

import com.aistareco.aep.dto.StudioOperationsDashboardDto;
import com.aistareco.aep.service.StudioOperationsDashboardService;
import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Studio 跨账户运营看板。全部端点只读，且只允许后台身份访问。 */
@RestController
@RequestMapping("/api/admin/studio-operations")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR','FINANCE_ADMIN')")
public class AdminStudioOperationsController {
    private final StudioOperationsDashboardService service;

    public AdminStudioOperationsController(StudioOperationsDashboardService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<StudioOperationsDashboardDto> dashboard(@RequestParam(defaultValue = "7") int days) {
        return ApiResponse.of(service.dashboard(days));
    }

    @GetMapping("/reconciliation-details")
    public ApiResponse<StudioOperationsDashboardDto.DetailPage> reconciliationDetails(
            @RequestParam String check,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(service.reconciliationDetails(check, page, size));
    }

    @GetMapping("/credit-events")
    public ApiResponse<StudioOperationsDashboardDto.CreditEventPage> creditEvents(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.of(service.creditEvents(days, type, query, page, size));
    }
}
