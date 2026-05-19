package com.aistareco.aep.controller;

import com.aistareco.aep.dto.SocialAccountDto;
import com.aistareco.aep.service.SocialAccountService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin 视图：跨用户社交账号列表。
 *
 * 路由：/api/admin/social-accounts
 * 角色：SUPER_ADMIN / OPERATOR（AepSecurityConfig.hasAnyRole）。
 * 仅读：禁用 / 解绑等写操作走用户自身路径或后续 v0.6 单独审批接口。
 */
@RestController
@RequestMapping("/api/admin/social-accounts")
public class AdminSocialAccountController {

    private final SocialAccountService service;

    public AdminSocialAccountController(SocialAccountService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SocialAccountDto>> list() {
        return ApiResponse.of(service.listAll());
    }
}
