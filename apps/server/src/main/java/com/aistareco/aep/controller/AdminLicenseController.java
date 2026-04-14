package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LicenseBatchDto;
import com.aistareco.aep.dto.LicenseKeyDto;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.service.LicenseService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminLicenseController {

    private final LicenseService licenseService;

    public AdminLicenseController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    // --- License Batches ---

    @GetMapping("/license-batches")
    public ApiResponse<Page<LicenseBatchDto>> listBatches(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(licenseService.listBatches(pageable));
    }

    @PostMapping("/license-batches")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LicenseBatchDto> createBatch(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(licenseService.createBatch(body));
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
    public ApiResponse<LicenseKeyDto> revokeKey(@PathVariable String id) {
        return ApiResponse.of(licenseService.revokeKey(id));
    }
}
