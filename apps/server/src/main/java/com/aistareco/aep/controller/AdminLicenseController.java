package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LicenseBatchDto;
import com.aistareco.aep.dto.LicenseKeyDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.service.LicenseService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin")
public class AdminLicenseController {

    private final LicenseService licenseService;

    public AdminLicenseController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    // --- License Batches ---

    @GetMapping("/license-batches")
    public ApiResponse<PageEnvelope<LicenseBatchDto>> listBatches(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(licenseService.listBatches(pageable)));
    }

    @GetMapping("/license-batches/{id}")
    public ApiResponse<LicenseBatchDto> getBatchById(@PathVariable String id) {
        return ApiResponse.of(licenseService.findBatchById(id));
    }

    @GetMapping("/license-batches/{id}/keys")
    public ApiResponse<PageEnvelope<LicenseKeyDto>> listKeysByBatch(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {

        LicenseKey.LicenseKeyStatus statusEnum = parseStatus(status);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(licenseService.listKeys(id, statusEnum, pageable)));
    }

    @PostMapping("/license-batches")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LicenseBatchDto> createBatch(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(licenseService.createBatch(body));
    }

    // --- License Keys ---

    @GetMapping("/license-keys")
    public ApiResponse<PageEnvelope<LicenseKeyDto>> listKeys(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String status) {

        LicenseKey.LicenseKeyStatus statusEnum = parseStatus(status);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(licenseService.listKeys(batchId, statusEnum, pageable)));
    }

    @PutMapping("/license-keys/{id}/revoke")
    public ApiResponse<LicenseKeyDto> revokeKey(@PathVariable String id) {
        return ApiResponse.of(licenseService.revokeKey(id));
    }

    private LicenseKey.LicenseKeyStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            return LicenseKey.LicenseKeyStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的卡密状态筛选值");
        }
    }
}
