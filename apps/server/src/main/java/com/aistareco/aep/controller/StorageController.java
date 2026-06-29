package com.aistareco.aep.controller;

import com.aistareco.aep.dto.StorageUsageDto;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * 通用存储用量查询（v0.92）。任意子应用前端用 {@code GET /api/me/storage?app=drama} 查
 * 当前用户在该子应用的存储占用 / 配额 / 余量 + 分类明细。/api/me/** authenticated。
 */
@RestController
@RequestMapping("/api/me/storage")
public class StorageController {

    private final StorageQuotaService service;

    public StorageController(StorageQuotaService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<StorageUsageDto> usage(Principal principal, @RequestParam(defaultValue = "drama") String app) {
        return ApiResponse.of(service.usage(app, principal.getName()));
    }
}
