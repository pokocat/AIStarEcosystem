package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdjustmentResult;
import com.aistareco.aep.dto.CreditAdjustmentRequestDto;
import com.aistareco.aep.service.CreditOpsService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 运营调差 / 赠送后台 + maker-checker（v2 §9 积分面 lane）。
 *
 * 路径在 /api/admin/** 下 → SUPER_ADMIN / OPERATOR / FINANCE_ADMIN 可访问。
 * 发起（compensate/grant）：小额直发，大额落审批单（OPERATOR 可发起）。
 * 复核（approve/reject）：@PreAuthorize 限 FINANCE_ADMIN / SUPER_ADMIN；服务端再校验 maker != checker。
 * 只发赠送积分（giftBalance），不碰资金面。操作人 = 当前 admin principal，写进账本溯源。
 */
@RestController
@RequestMapping("/api/admin/finance/adjustments")
public class AdminCreditOpsController {

    private final CreditOpsService creditOpsService;

    public AdminCreditOpsController(CreditOpsService creditOpsService) {
        this.creditOpsService = creditOpsService;
    }

    /** 客诉补偿：给用户补发积分，挂工单号。小额直发，大额进审批。 */
    @PostMapping("/compensate")
    public ApiResponse<AdjustmentResult> compensate(Principal principal,
                                                    @RequestBody(required = false) CompensateRequest req) {
        requireBody(req);
        return ApiResponse.of(creditOpsService.compensate(
                req.userId(), req.amount(), req.incidentRef(), req.reason(), operator(principal)));
    }

    /** 激励赠送：给用户发赠送积分，可挂活动号。小额直发，大额进审批。 */
    @PostMapping("/grant")
    public ApiResponse<AdjustmentResult> grant(Principal principal,
                                               @RequestBody(required = false) GrantRequest req) {
        requireBody(req);
        return ApiResponse.of(creditOpsService.grantGift(
                req.userId(), req.amount(), req.campaignId(), req.reason(), operator(principal)));
    }

    /** 审批队列（status: pending_approval / approved / rejected / all）。 */
    @GetMapping("/requests")
    public ApiResponse<List<CreditAdjustmentRequestDto>> listRequests(@RequestParam(required = false) String status) {
        return ApiResponse.of(creditOpsService.listRequests(status));
    }

    /** 批准大额审批单（复核人，限 FINANCE_ADMIN / SUPER_ADMIN）。 */
    @PostMapping("/requests/{id}/approve")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<CreditAdjustmentRequestDto> approve(Principal principal, @PathVariable String id) {
        return ApiResponse.of(creditOpsService.approve(id, operator(principal)));
    }

    /** 驳回大额审批单（复核人，限 FINANCE_ADMIN / SUPER_ADMIN）。 */
    @PostMapping("/requests/{id}/reject")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<CreditAdjustmentRequestDto> reject(Principal principal, @PathVariable String id,
                                                          @RequestBody(required = false) RejectRequest req) {
        return ApiResponse.of(creditOpsService.reject(id, operator(principal), req == null ? null : req.note()));
    }

    private static void requireBody(Object req) {
        if (req == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "BODY_REQUIRED", "缺少请求体");
        }
    }

    private static String operator(Principal principal) {
        return principal != null ? principal.getName() : null;
    }

    public record CompensateRequest(String userId, long amount, String incidentRef, String reason) {}
    public record GrantRequest(String userId, long amount, String campaignId, String reason) {}
    public record RejectRequest(String note) {}
}
