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

import java.util.Map;

/**
 * Public endpoint for account registration via license key activation.
 * License keys can be imported by system admins or synced from external CRM systems (future).
 */
@RestController
@RequestMapping("/api/auth")
public class LicenseActivationController {

    private final LicenseActivationService activationService;
    private final AuditService auditService;

    public LicenseActivationController(LicenseActivationService activationService,
                                        AuditService auditService) {
        this.activationService = activationService;
        this.auditService = auditService;
    }

    /**
     * Activate a license key to register or onboard an account.
     * Accepts: { "code": "RAW-LICENSE-KEY", "username": "...", "email": "...", "phone": "..." }
     * The code is the raw license key that gets SHA-256 hashed for lookup.
     */
    @PostMapping("/activate")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> activate(@RequestBody Map<String, String> body,
                                                     HttpServletRequest request) {
        String requestedUsername = body == null ? null : body.get("username");
        String phone = body == null ? null : body.get("phone");
        String platform = body == null ? null : body.get("platform");

        Map<String, Object> result;
        try {
            result = activationService.activate(body);
        } catch (RuntimeException ex) {
            auditService.recordAuthFailure(AuditService.Actions.LICENSE_ACTIVATE,
                    requestedUsername != null ? requestedUsername : phone,
                    errorCodeOf(ex, "LICENSE_ACTIVATE_FAILED"),
                    "激活码注册失败 phone=" + phone + " platform=" + platform + " · " + ex.getMessage(),
                    request);
            throw ex;
        }

        // 成功 → 落审计。result 含 user (AepUserDto) / token / tenantId / sellingChannelId。
        Object userObj = result.get("user");
        String userId = null;
        String username = null;
        if (userObj instanceof AepUserDto dto) {
            userId = dto.id();
            username = dto.username();
        }
        auditService.recordAuthSuccess(AuditService.Actions.LICENSE_ACTIVATE,
                userId,
                username != null ? username : (requestedUsername != null ? requestedUsername : phone),
                "激活码注册成功 phone=" + phone + " platform=" + platform, request);
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
