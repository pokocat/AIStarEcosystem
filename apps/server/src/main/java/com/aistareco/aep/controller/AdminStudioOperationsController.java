package com.aistareco.aep.controller;

import com.aistareco.aep.dto.StudioOperationsDashboardDto;
import com.aistareco.aep.dto.StudioSupplierPerformanceDto;
import com.aistareco.aep.service.StudioOperationsDashboardService;
import com.aistareco.aep.service.StudioSupplierPerformanceService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.concurrent.TimeUnit;

/** Studio 跨账户运营看板。全部端点只读，且只允许后台身份访问。 */
@RestController
@RequestMapping("/api/admin/studio-operations")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR','FINANCE_ADMIN')")
public class AdminStudioOperationsController {
    private final StudioOperationsDashboardService service;
    private final StudioSupplierPerformanceService supplierPerformance;

    public AdminStudioOperationsController(StudioOperationsDashboardService service,
                                           StudioSupplierPerformanceService supplierPerformance) {
        this.service = service;
        this.supplierPerformance = supplierPerformance;
    }

    @GetMapping
    public ApiResponse<StudioOperationsDashboardDto> dashboard(
            @RequestParam(defaultValue = "7") int days,
            @RequestParam(defaultValue = "all") String scope) {
        return ApiResponse.of(service.dashboard(days, scope));
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

    @GetMapping("/supplier-performance")
    public ResponseEntity<ApiResponse<StudioSupplierPerformanceDto>> supplierPerformance(
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "Asia/Shanghai") String timezone,
            @RequestParam(required = false) String supplier,
            @RequestParam(required = false) String model,
            @RequestParam(defaultValue = "all") String mediaType,
            @RequestParam(defaultValue = "all") String status,
            @RequestParam(required = false) List<String> exclude,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var body = supplierPerformance.query(from, to, timezone, supplier, model, mediaType, status,
                exclude, query, page, size);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePrivate())
                .body(ApiResponse.of(body));
    }
}
