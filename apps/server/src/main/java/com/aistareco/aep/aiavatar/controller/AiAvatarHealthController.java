package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarProviderHealthDto;
import com.aistareco.aep.aiavatar.service.AiAvatarProviderHealthService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Provider 健康可观测（任务书 §6.3 GET /api/health/providers）。
 *
 * 放在 {@code /api/aiavatar/health/providers}（permitAll）—— 任何人可查每能力当前 mode + 实现来源，
 * 让测试者一眼分辨哪些走 mock / 哪些走真实方案。
 */
@RestController
@RequestMapping("/api/aiavatar/health")
public class AiAvatarHealthController {

    private final AiAvatarProviderHealthService healthService;

    public AiAvatarHealthController(AiAvatarProviderHealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/providers")
    public ApiResponse<List<AiAvatarProviderHealthDto>> providers() {
        return ApiResponse.of(healthService.report());
    }
}
