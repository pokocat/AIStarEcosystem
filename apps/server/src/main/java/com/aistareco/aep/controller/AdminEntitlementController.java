package com.aistareco.aep.controller;

import com.aistareco.aep.dto.EntitlementDto;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.EntitlementService;
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
@RequestMapping("/api/admin/entitlements")
public class AdminEntitlementController {

    private final EntitlementService entitlementService;
    private final AdminAuditRecorder auditRecorder;

    public AdminEntitlementController(EntitlementService entitlementService, AdminAuditRecorder auditRecorder) {
        this.entitlementService = entitlementService;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping
    public ApiResponse<Page<EntitlementDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String productId) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(entitlementService.list(tenantId, productId, pageable));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EntitlementDto> create(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        EntitlementDto entitlement = entitlementService.create(body);
        auditRecorder.success(principal, request, "entitlement.create", "entitlement", entitlement.id(), "创建权益");
        return ApiResponse.of(entitlement);
    }

    @PutMapping("/{id}")
    public ApiResponse<EntitlementDto> update(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        EntitlementDto entitlement = entitlementService.update(id, body);
        auditRecorder.success(principal, request, "entitlement.update", "entitlement", id, "更新权益");
        return ApiResponse.of(entitlement);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(
            @PathVariable String id,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        entitlementService.revoke(id);
        auditRecorder.success(principal, request, "entitlement.revoke", "entitlement", id, "撤销权益");
    }
}
