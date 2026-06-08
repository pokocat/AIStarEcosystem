package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreateLicenseBatchResultDto;
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
@org.springframework.security.access.prepost.PreAuthorize("@accountSourceResolver.isAdmin(authentication)")
public class AdminLicenseController {

    private final LicenseService licenseService;

    public AdminLicenseController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    // --- License Batches ---

    @GetMapping("/license-batches")
    public PageEnvelope<LicenseBatchDto> listBatches(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(licenseService.listBatches(pageable));
    }

    @GetMapping("/license-batches/{id}")
    public ApiResponse<LicenseBatchDto> getBatchById(@PathVariable String id) {
        return ApiResponse.of(licenseService.findBatchById(id));
    }

    @GetMapping("/license-batches/{id}/keys")
    public PageEnvelope<LicenseKeyDto> listKeysByBatch(
            @PathVariable String id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {

        LicenseKey.LicenseKeyStatus statusEnum = parseStatus(status);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(licenseService.listKeys(id, statusEnum, pageable));
    }

    @PostMapping("/license-batches")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CreateLicenseBatchResultDto> createBatch(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(licenseService.createBatch(body));
    }

    /**
     * v0.31+: 在已有 batch 下新铸 N 把 key，**一次性返回 raw codes**（仅本响应；DB 只存 sha256）。
     * 用于 admin 直接生成激活码线下/线上分发给用户（区别于 createBatch：不再额外建批次）。
     * raw 是敏感信息，调用方有责任安全传递。
     */
    @PostMapping("/license-batches/{id}/mint-keys")
    public ApiResponse<Map<String, Object>> mintKeys(@PathVariable String id,
                                                     @RequestParam(defaultValue = "1") int count) {
        java.util.List<String> raws = licenseService.mintKeysAndReturnRawCodes(id, count);
        return ApiResponse.of(Map.of("batchId", id, "count", raws.size(), "rawCodes", raws));
    }

    @PutMapping("/license-batches/{id}/revoke")
    public ApiResponse<LicenseBatchDto> revokeBatch(@PathVariable String id) {
        return ApiResponse.of(licenseService.revokeBatch(id));
    }

    // --- License Keys ---

    @GetMapping("/license-keys")
    public PageEnvelope<LicenseKeyDto> listKeys(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String batchId,
            @RequestParam(required = false) String status) {

        LicenseKey.LicenseKeyStatus statusEnum = parseStatus(status);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(licenseService.listKeys(batchId, statusEnum, pageable));
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
