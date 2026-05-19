package com.aistareco.aep.controller;

import com.aistareco.aep.dto.PublishJobCallbackDto;
import com.aistareco.aep.service.PublishJobService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * sau-service → server 的内部回调端点。
 *
 *   POST /api/internal/sau/job-callback   { externalTaskId, status, progress?, externalUrl?, errorCode?, errorMessage? }
 *
 * 鉴权由 InternalAuthFilter (X-Internal-Secret) 完成 + AepSecurityConfig 路由策略
 * (/api/internal/** has ROLE_INTERNAL)。
 * 幂等性见 PublishJobService.applyCallback —— 按 externalTaskId 单调推进。
 */
@RestController
@RequestMapping("/api/internal/sau")
public class InternalSauCallbackController {

    private final PublishJobService publishJobService;

    public InternalSauCallbackController(PublishJobService publishJobService) {
        this.publishJobService = publishJobService;
    }

    @PostMapping("/job-callback")
    public ApiResponse<Map<String, Object>> jobCallback(@RequestBody PublishJobCallbackDto payload) {
        publishJobService.applyCallback(payload);
        return ApiResponse.of(Map.of("acked", true));
    }
}
