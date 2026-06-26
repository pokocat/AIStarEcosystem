package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.service.PaymentService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * 充值在线支付下单（v2 §7）。子应用内发起，后端经 {@link PaymentService} 调钱包/支付网关开单。
 * 路径在 /api/me/** 下 → 需登录（owner = principal）。
 */
@RestController
@RequestMapping("/api/me/wallet")
public class WalletPayController {

    private final PaymentService paymentService;

    public WalletPayController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/recharge/checkout")
    public ApiResponse<CheckoutResponse> checkout(Principal principal,
                                                  @RequestBody(required = false) CheckoutRequest req) {
        if (req == null || req.packageId() == null || req.packageId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PACKAGE_ID_REQUIRED", "请选择充值套餐");
        }
        return ApiResponse.of(paymentService.checkout(
                principal.getName(), req.packageId(), req.wayCode(), req.openid(), null, req.sourceApp()));
    }

    public record CheckoutRequest(String packageId, String wayCode, String openid, String sourceApp) {}
}
