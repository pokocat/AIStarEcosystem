package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.service.CreditOpsService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * 运营调差 / 赠送后台（v2 §9 积分面 lane）。
 *
 * 路径在 /api/admin/** 下 → 受 SUPER_ADMIN / OPERATOR 门禁（角色拆分后归 PLATFORM_OPERATOR）。
 * 只发赠送积分（giftBalance），不碰资金面。操作人 = 当前 admin principal，写进账本溯源。
 */
@RestController
@RequestMapping("/api/admin/finance/adjustments")
public class AdminCreditOpsController {

    private final CreditOpsService creditOpsService;

    public AdminCreditOpsController(CreditOpsService creditOpsService) {
        this.creditOpsService = creditOpsService;
    }

    /** 客诉补偿：给用户补发积分，挂工单号。 */
    @PostMapping("/compensate")
    public ApiResponse<LedgerEntryDto> compensate(Principal principal,
                                                  @RequestBody(required = false) CompensateRequest req) {
        if (req == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "BODY_REQUIRED", "缺少请求体");
        }
        return ApiResponse.of(creditOpsService.compensate(
                req.userId(), req.amount(), req.incidentRef(), req.reason(), operator(principal)));
    }

    /** 激励赠送：给用户发赠送积分，可挂活动号。 */
    @PostMapping("/grant")
    public ApiResponse<LedgerEntryDto> grant(Principal principal,
                                             @RequestBody(required = false) GrantRequest req) {
        if (req == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "BODY_REQUIRED", "缺少请求体");
        }
        return ApiResponse.of(creditOpsService.grantGift(
                req.userId(), req.amount(), req.campaignId(), req.reason(), operator(principal)));
    }

    private static String operator(Principal principal) {
        return principal != null ? principal.getName() : null;
    }

    public record CompensateRequest(String userId, long amount, String incidentRef, String reason) {}
    public record GrantRequest(String userId, long amount, String campaignId, String reason) {}
}
