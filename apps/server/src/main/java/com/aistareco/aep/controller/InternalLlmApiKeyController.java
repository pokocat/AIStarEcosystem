package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.LlmKeyValidationDto;
import com.aistareco.aep.dto.LlmUsageReportDto;
import com.aistareco.aep.service.AiModelEndpointKeyService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * llm-gateway → server（v0.41：Key 折叠进 AiModelEndpoint，委派 AiModelEndpointKeyService）：
 *   - POST /api/internal/llm-keys/validate  { apiKey } → { ok, keyId, userId, name }
 *   - POST /api/internal/llm-keys/usage     { keyId, model, totalTokens, ... } → { entry }
 *
 * URL / 返回体形状保持不变（gateway 硬编码）。validate/usage 优先命中端点，未命中回退旧 LlmApiKey。
 * 鉴权由 InternalAuthFilter 完成（X-Internal-Secret）。
 */
@RestController
@RequestMapping("/api/internal/llm-keys")
public class InternalLlmApiKeyController {

    private final AiModelEndpointKeyService service;

    public InternalLlmApiKeyController(AiModelEndpointKeyService service) {
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
