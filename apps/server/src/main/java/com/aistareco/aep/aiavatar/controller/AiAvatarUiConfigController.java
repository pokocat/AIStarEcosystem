package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarUiConfigDto;
import com.aistareco.aep.aiavatar.service.AiAvatarUiConfigService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AiAvatar UI 文案配置 · 创作者只读（/api/me/aiavatar/ui-config）。
 * 写入见 {@link AiAvatarAdminController}（运营 PUT /api/admin/aiavatar/ui-config）。
 */
@RestController
@RequestMapping("/api/me/aiavatar/ui-config")
public class AiAvatarUiConfigController {

    private final AiAvatarUiConfigService service;

    public AiAvatarUiConfigController(AiAvatarUiConfigService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<AiAvatarUiConfigDto> get() {
        return ApiResponse.of(service.get());
    }
}
