package com.aistareco.aep.controller;

import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.TenantService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/tenants")
public class AdminTenantController {

    private final TenantService tenantService;
    private final AdminAuditRecorder auditRecorder;

    public AdminTenantController(TenantService tenantService, AdminAuditRecorder auditRecorder) {
        this.tenantService = tenantService;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping
    public ApiResponse<Page<TenantDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(tenantService.list(pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<TenantDto> getById(@PathVariable String id) {
        return ApiResponse.of(tenantService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<TenantDto> create(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        TenantDto tenant = tenantService.create(body);
        auditRecorder.success(principal, request, "tenant.create", "tenant", tenant.id(), "创建租户");
        return ApiResponse.of(tenant);
    }

    @PutMapping("/{id}")
    public ApiResponse<TenantDto> update(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        TenantDto tenant = tenantService.update(id, body);
        auditRecorder.success(principal, request, "tenant.update", "tenant", id, "更新租户");
        return ApiResponse.of(tenant);
    }
}
