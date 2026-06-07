package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.LicenseActivationService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * v0.53：已登录账号「追加激活」秘钥（/api/me/** → authenticated）。
 *
 * 与公开的 POST /api/auth/activate（注册新账号）互补：
 * 老账号买了一把新秘钥（如「仅 aiavatar · 1000 积分」批次）即可在不换号的前提下
 * 开通对应子应用 + 追加发放积分。复用 {@link AuditService.Actions#LICENSE_ACTIVATE}
 * 动作落审计（detail 标注「追加激活」），admin「账号登录日志」无需新增字典项。
 */
@RestController
@RequestMapping("/api/me/license")
public class MeLicenseController {

    private final LicenseActivationService activationService;
    private final AuditService auditService;

    public MeLicenseController(LicenseActivationService activationService,
                               AuditService auditService) {
        this.activationService = activationService;
        this.auditService = auditService;
    }

    /**
     * POST /api/me/license/activate { code }
     * 返回 { user, creditsGranted, newTotalBalance, platformsGranted }。
     */
    @PostMapping("/activate")
    public ApiResponse<Map<String, Object>> activate(Principal principal,
                                                     @RequestBody Map<String, String> body,
                                                     HttpServletRequest request) {
        String userId = principal.getName();
        String code = body == null ? null : body.get("code");

        Map<String, Object> result;
        try {
            result = activationService.activateForExistingUser(userId, code);
        } catch (RuntimeException ex) {
            auditService.recordAuth(AuditService.Actions.LICENSE_ACTIVATE,
                    com.aistareco.aep.model.AuditLog.AuditResult.FAILURE,
                    userId, null,
                    errorCodeOf(ex, "LICENSE_APPEND_ACTIVATE_FAILED"),
                    "追加激活失败（已登录账号） · " + ex.getMessage(), request);
            throw ex;
        }

        Object userObj = result.get("user");
        String username = userObj instanceof AepUserDto dto ? dto.username() : null;
        auditService.recordAuthSuccess(AuditService.Actions.LICENSE_ACTIVATE,
                userId, username,
                "追加激活成功（已登录账号）platformsGranted=" + result.get("platformsGranted")
                        + " creditsGranted=" + result.get("creditsGranted"), request);
        return ApiResponse.of(result);
    }

    private static String errorCodeOf(Throwable ex, String fallback) {
        if (ex instanceof BusinessException bex) return bex.getCode();
        if (ex instanceof ResponseStatusException rsx) {
            return rsx.getStatusCode().value() + "";
        }
        return fallback;
    }
}
