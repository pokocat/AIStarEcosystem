package com.aistareco.aep.enrollment.controller;

import com.aistareco.aep.dto.EnrollmentDto;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 子产品开通（v0.149，docs/unified-identity-plan.md §12.2）。
 *
 * <p>{@code /api/me/enrollments/**} 在 {@code EnrollmentGuard} 的白名单里 ——
 * 未开通的账号必须能访问它，否则「去开通」这条路自己把自己挡住。</p>
 */
@RestController
@RequestMapping("/api/me/enrollments")
public class MeEnrollmentController {

    private final EnrollmentService enrollmentService;
    private final AuditService auditService;

    public MeEnrollmentController(EnrollmentService enrollmentService, AuditService auditService) {
        this.enrollmentService = enrollmentService;
        this.auditService = auditService;
    }

    /** 当前账号全部子产品开通状态。 */
    @GetMapping
    public ApiResponse<List<EnrollmentDto>> list(Principal principal) {
        return ApiResponse.of(enrollmentService.listFor(principal.getName()));
    }

    /** 用激活码开通某个子产品。已开通再激活 = 追加权益（积分照发）。 */
    @PostMapping("/{product}/activate")
    public ApiResponse<EnrollmentDto> activate(Principal principal,
                                               @PathVariable String product,
                                               @RequestBody(required = false) Map<String, String> body,
                                               HttpServletRequest request) {
        String userId = principal.getName();
        String licenseKey = body == null ? null : body.get("licenseKey");
        EnrollmentDto dto;
        try {
            dto = enrollmentService.activateWithLicense(userId, product, licenseKey);
        } catch (RuntimeException ex) {
            auditService.recordAuth(AuditService.Actions.LICENSE_ACTIVATE,
                    com.aistareco.aep.model.AuditLog.AuditResult.FAILURE,
                    userId, null,
                    errorCodeOf(ex, "ENROLLMENT_ACTIVATE_FAILED"),
                    "子产品开通失败 product=" + product + " · " + ex.getMessage(), request);
            throw ex;
        }
        auditService.recordAuthSuccess(AuditService.Actions.LICENSE_ACTIVATE, userId, null,
                "子产品开通成功 product=" + product, request);
        return ApiResponse.of(dto);
    }

    private static String errorCodeOf(Throwable ex, String fallback) {
        if (ex instanceof BusinessException bex) return bex.getCode();
        if (ex instanceof ResponseStatusException rsx) return String.valueOf(rsx.getStatusCode().value());
        return fallback;
    }
}
