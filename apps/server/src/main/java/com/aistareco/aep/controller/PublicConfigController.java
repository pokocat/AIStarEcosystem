package com.aistareco.aep.controller;

import com.aistareco.aep.service.FeatureConfigService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class PublicConfigController {

    private final FeatureConfigService featureConfigService;

    public PublicConfigController(FeatureConfigService featureConfigService) {
        this.featureConfigService = featureConfigService;
    }

    @GetMapping("/api/config/frontend")
    public ApiResponse<Map<String, Object>> frontendConfig() {
        return ApiResponse.of(featureConfigService.frontendConfig());
    }

    @GetMapping("/api/config/frontend/{group}")
    public ApiResponse<Map<String, Object>> frontendConfigGroup(@PathVariable String group) {
        return ApiResponse.of(featureConfigService.frontendConfigGroup(group));
    }

    @GetMapping("/api/config/plan-limits")
    public ApiResponse<Map<String, Object>> planLimits() {
        return ApiResponse.of(featureConfigService.planLimits());
    }

    @GetMapping("/internal/config/{key}")
    public ApiResponse<Object> internalConfig(
            @PathVariable String key,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String planId,
            @RequestParam(required = false) String productId
    ) {
        return ApiResponse.of(featureConfigService.resolveSingleValue(key, tenantId, planId, productId));
    }

    @PostMapping("/internal/config/resolve")
    public ApiResponse<Map<String, Object>> resolveMany(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> keys = (List<String>) body.getOrDefault("keys", List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> context = (Map<String, Object>) body.getOrDefault("context", Map.of());
        return ApiResponse.of(featureConfigService.resolveMany(keys, context));
    }
}
