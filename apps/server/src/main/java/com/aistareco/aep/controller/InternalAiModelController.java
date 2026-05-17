package com.aistareco.aep.controller;

import com.aistareco.aep.dto.InternalUpstreamDto;
import com.aistareco.aep.service.AiModelProviderInternalService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 仅供 apps/llm-gateway 调用。X-Internal-Secret 校验在 InternalAuthFilter 中完成。
 */
@RestController
@RequestMapping("/api/internal/ai-models")
public class InternalAiModelController {

    private final AiModelProviderInternalService service;

    public InternalAiModelController(AiModelProviderInternalService service) {
        this.service = service;
    }

    @GetMapping("/upstreams")
    public ApiResponse<List<InternalUpstreamDto>> upstreams() {
        return ApiResponse.of(service.listEnabledUpstreams());
    }
}
