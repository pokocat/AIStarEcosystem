package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 管理端平台配置 CRUD：/api/admin/platform-configs。
 * 需 SUPER_ADMIN / OPERATOR 角色（由 SecurityConfig 统一拦截）。
 */
@RestController
@RequestMapping("/api/admin/platform-configs")
public class AdminPlatformConfigController {

    private final PlatformConfigService service;

    public AdminPlatformConfigController(PlatformConfigService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PlatformConfigDto>> list() {
        return ApiResponse.of(service.listAll());
    }

    @GetMapping("/{key}")
    public ApiResponse<PlatformConfigDto> get(@PathVariable String key) {
        return ApiResponse.of(service.requireByKey(key));
    }

    /**
     * PUT /api/admin/platform-configs/{key}
     * Body 形式：{ "value": <任意 JSON>, "description": "..." }
     * 或者直接把 JSON 作为 value（兼容形式，body 就是 value 本身）。
     */
    @PutMapping("/{key}")
    public ApiResponse<PlatformConfigDto> upsert(
            Principal principal,
            @PathVariable String key,
            @RequestBody JsonNode body
    ) {
        JsonNode value;
        String description;
        if (body != null && body.isObject() && body.has("value")) {
            value = body.get("value");
            description = body.hasNonNull("description") ? body.get("description").asText() : null;
        } else {
            value = body;
            description = null;
        }
        String updatedBy = principal == null ? "system" : principal.getName();
        return ApiResponse.of(service.upsert(key, value, description, updatedBy));
    }

    @DeleteMapping("/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String key) {
        service.delete(key);
    }

    /** 批量 upsert 便利端点：body 为 key → value 映射。 */
    @PostMapping("/bulk")
    public ApiResponse<Map<String, Integer>> bulkUpsert(
            Principal principal,
            @RequestBody Map<String, JsonNode> body
    ) {
        String updatedBy = principal == null ? "system" : principal.getName();
        int updated = 0;
        for (Map.Entry<String, JsonNode> e : body.entrySet()) {
            service.upsert(e.getKey(), e.getValue(), null, updatedBy);
            updated++;
        }
        return ApiResponse.of(Map.of("updated", updated));
    }
}
