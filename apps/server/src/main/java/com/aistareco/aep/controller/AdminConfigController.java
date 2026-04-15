package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ConfigChangeLogDto;
import com.aistareco.aep.dto.FeatureConfigDto;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.FeatureConfigService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/config")
public class AdminConfigController {

    private final FeatureConfigService featureConfigService;
    private final AuditService auditService;

    public AdminConfigController(FeatureConfigService featureConfigService, AuditService auditService) {
        this.featureConfigService = featureConfigService;
        this.auditService = auditService;
    }

    @GetMapping
    public ApiResponse<Page<FeatureConfigDto>> list(
            @RequestParam(required = false) String group,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("configGroup").ascending().and(Sort.by("configKey").ascending()));
        return ApiResponse.of(featureConfigService.list(group, pageable));
    }

    @GetMapping("/groups")
    public ApiResponse<List<String>> groups() {
        return ApiResponse.of(featureConfigService.groups());
    }

    @GetMapping("/{key}")
    public ApiResponse<FeatureConfigDto> get(@PathVariable String key) {
        return ApiResponse.of(featureConfigService.get(key));
    }

    @GetMapping("/{key}/history")
    public ApiResponse<List<ConfigChangeLogDto>> history(@PathVariable String key) {
        return ApiResponse.of(featureConfigService.history(key));
    }

    @PatchMapping("/{key}")
    public ApiResponse<FeatureConfigDto> update(
            @PathVariable String key,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        FeatureConfigDto result = featureConfigService.update(key, body, principal);
        auditService.record(
                principal.userId(),
                null,
                "config.update",
                "feature_config",
                key,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                AuditLog.AuditResult.SUCCESS,
                "更新配置项"
        );
        return ApiResponse.of(result);
    }

    @PostMapping("/{key}/revert")
    public ApiResponse<FeatureConfigDto> revert(
            @PathVariable String key,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        FeatureConfigDto result = featureConfigService.revert(key, principal);
        auditService.record(
                principal.userId(),
                null,
                "config.revert",
                "feature_config",
                key,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                AuditLog.AuditResult.SUCCESS,
                "回滚配置项"
        );
        return ApiResponse.of(result);
    }
}
