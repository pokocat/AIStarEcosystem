package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminAiModelProviderUpsertDto;
import com.aistareco.aep.dto.AiModelProviderDto;
import com.aistareco.aep.service.AiModelProviderAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin AI 模型 provider 配置：/api/admin/ai-models/*。v0.5 §D8 新增。
 *
 * apiKey 永远不在响应中明文返回（DTO 内部脱敏）。
 */
@RestController
@RequestMapping("/api/admin/ai-models")
public class AdminAiModelProviderController {

    private final AiModelProviderAdminService service;

    public AdminAiModelProviderController(AiModelProviderAdminService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AiModelProviderDto>> list() {
        return ApiResponse.of(service.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<AiModelProviderDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AiModelProviderDto> create(@RequestBody AdminAiModelProviderUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<AiModelProviderDto> update(@PathVariable String id,
                                                    @RequestBody AdminAiModelProviderUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @PostMapping("/{id}/test")
    public ApiResponse<Map<String, Object>> test(@PathVariable String id) {
        return ApiResponse.of(service.testConnection(id));
    }
}
