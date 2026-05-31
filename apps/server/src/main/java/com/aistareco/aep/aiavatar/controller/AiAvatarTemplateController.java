package com.aistareco.aep.aiavatar.controller;

import com.aistareco.aep.aiavatar.dto.AiAvatarTemplateDto;
import com.aistareco.aep.aiavatar.service.AiAvatarTemplateService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * AI 模板中心 · 用户只读视图（/api/me/aiavatar/templates）。工厂模板 + 自己私有。
 * 管理见 {@link AiAvatarAdminController}。
 */
@RestController
@RequestMapping("/api/me/aiavatar/templates")
public class AiAvatarTemplateController {

    private final AiAvatarTemplateService service;

    public AiAvatarTemplateController(AiAvatarTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AiAvatarTemplateDto>> list(Principal principal) {
        String uid = principal == null ? "" : principal.getName();
        return ApiResponse.of(service.listVisibleTo(uid));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiAvatarTemplateDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }
}
