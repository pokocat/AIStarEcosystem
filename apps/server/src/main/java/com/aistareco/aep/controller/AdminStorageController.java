package com.aistareco.aep.controller;

import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.LongNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 通用存储配额后台配置（v0.92）。运营 / 管理员按子应用配置单账户存储配额（MB），
 * 写入 PlatformConfig key {@code storage.quota_mb.<app>}（缺省 {@code storage.quota_mb.default}）。
 * /api/admin/** → SUPER_ADMIN / OPERATOR。
 */
@RestController
@RequestMapping("/api/admin/storage")
public class AdminStorageController {

    /** 已知子应用域（前端展示顺序）。default 为全局兜底。 */
    private static final List<String> APPS = List.of("default", "drama", "celebrity", "music", "aiavatar", "star");

    private final PlatformConfigService configs;
    private final StorageQuotaService storage;

    public AdminStorageController(PlatformConfigService configs, StorageQuotaService storage) {
        this.configs = configs;
        this.storage = storage;
    }

    /** 列出各子应用当前配额（MB）。 */
    @GetMapping("/quotas")
    public ApiResponse<Map<String, Long>> quotas() {
        Map<String, Long> out = new LinkedHashMap<>();
        for (String app : APPS) {
            long v = configs.getLong("storage.quota_mb." + app, app.equals("default") ? StorageQuotaService.DEFAULT_QUOTA_MB : -1);
            out.put(app, v > 0 ? v : storage.quotaMb(app));
        }
        return ApiResponse.of(out);
    }

    /** 设置某子应用配额（MB）。body: { quotaMb }。 */
    @PutMapping("/quotas/{app}")
    public ApiResponse<Map<String, Long>> setQuota(Principal principal, @PathVariable String app, @RequestBody JsonNode body) {
        long quotaMb = body.path("quotaMb").asLong(0);
        if (quotaMb <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "QUOTA_INVALID", "quotaMb 必须为正整数（MB）");
        }
        configs.upsert("storage.quota_mb." + app, new LongNode(quotaMb),
                "存储配额（MB）· " + app, principal != null ? principal.getName() : "admin");
        return ApiResponse.of(Map.of(app, quotaMb));
    }
}
