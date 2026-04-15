package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LicenseBatchDto;
import com.aistareco.aep.dto.LicenseKeyDto;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.LicenseService;
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
@RequestMapping("/api/admin")
public class AdminLicenseController {

    private final LicenseService licenseService;
    private final AdminAuditRecorder auditRecorder;

    public AdminLicenseController(LicenseService licenseService, AdminAuditRecorder auditRecorder) {
        this.licenseService = licenseService;
        this.auditRecorder = auditRecorder;
    }

    // --- License Batches ---

    @GetMapping("/license-batches")
    public ApiResponse<Page<LicenseBatchDto>> listBatches(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(licenseService.listBatches(pageable));
    }

    @GetMapping("/license-batches/{id}")
    public ApiResponse<LicenseBatchDto> getBatchById(@PathVariable String id) {
        return ApiResponse.of(licenseService.findBatchById(id));
    }

    @PostMapping("/license-batches")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LicenseBatchDto> createBatch(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        LicenseBatchDto batch = licenseService.createBatch(body);
        auditRecorder.success(principal, request, "license_batch.create", "license_batch", batch.id(), "创建许可证批次");
        return ApiResponse.of(batch);
    }

    // --- License Keys ---

    @GetMapping("/license-keys")
    public ApiResponse<Page<LicenseKeyDto>> listKeys(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String status) {

        LicenseKey.LicenseKeyStatus statusEnum = status != null ? LicenseKey.LicenseKeyStatus.valueOf(status) : null;
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(licenseService.listKeys(batchId, statusEnum, pageable));
    }

    @PutMapping("/license-keys/{id}/revoke")
    public ApiResponse<LicenseKeyDto> revokeKey(
            @PathVariable String id,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        LicenseKeyDto key = licenseService.revokeKey(id);
        auditRecorder.success(principal, request, "license_key.revoke", "license_key", id, "吊销许可证");
        return ApiResponse.of(key);
    }
}
