package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.LlmKeyValidationDto;
import com.aistareco.aep.dto.LlmUsageReportDto;
import com.aistareco.aep.service.LlmApiKeyService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * llm-gateway → server：
 *   - POST /api/internal/llm-keys/validate  { apiKey } → { ok, keyId, userId, name }
 *   - POST /api/internal/llm-keys/usage     { keyId, model, totalTokens, ... } → { entry }
 *
 * 鉴权由 InternalAuthFilter 完成（X-Internal-Secret）。
 */
@RestController
@RequestMapping("/api/internal/llm-keys")
public class InternalLlmApiKeyController {

    private final LlmApiKeyService service;

    public InternalLlmApiKeyController(LlmApiKeyService service) {
        this.service = service;
    }

    @PostMapping("/validate")
    public ApiResponse<LlmKeyValidationDto> validate(@RequestBody Map<String, String> body) {
        return ApiResponse.of(service.validate(body.get("apiKey")));
    }

    @PostMapping("/usage")
    public ApiResponse<LedgerEntryDto> usage(@RequestBody LlmUsageReportDto report) {
        return ApiResponse.of(service.reportUsage(report));
    }
}
