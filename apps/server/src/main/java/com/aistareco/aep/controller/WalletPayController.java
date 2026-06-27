package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CheckoutResponse;
import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.PaymentService;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * 充值在线支付下单 + 收银台（v2 §6/§7）。子应用内发起，后端经 {@link PaymentService} 调支付网关开单；
 * 收银台中间页轮询订单态 + 主动查单。路径在 /api/me/** 下 → 需登录（owner = principal，逐单归属校验）。
 */
@RestController
@RequestMapping("/api/me/wallet")
public class WalletPayController {

    private final PaymentService paymentService;
    private final RechargeService rechargeService;

    public WalletPayController(PaymentService paymentService, RechargeService rechargeService) {
        this.paymentService = paymentService;
        this.rechargeService = rechargeService;
    }

    /** 收银台「确认支付」：建/复用 PENDING 单 → 网关下单 → 返回 payData（页面跳转 / 二维码 / 影子）。 */
    @PostMapping("/recharge/checkout")
    public ApiResponse<CheckoutResponse> checkout(Principal principal,
                                                  @RequestBody(required = false) CheckoutRequest req) {
        if (req == null || req.packageId() == null || req.packageId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PACKAGE_ID_REQUIRED", "请选择充值套餐");
        }
        return ApiResponse.of(paymentService.checkout(
                principal.getName(), req.packageId(), req.wayCode(), req.openid(), null, req.sourceApp()));
    }

    /** 收银台轮询：取单当前态（归属校验）。 */
    @GetMapping("/recharge/orders/{orderId}")
    public ApiResponse<RechargeOrderDto> getOrder(Principal principal, @PathVariable String orderId) {
        return ApiResponse.of(rechargeService.getOrderForUser(principal.getName(), orderId));
    }

    /** 收银台「我已支付 / 刷新状态」：主动查网关 → 已支付则结算（幂等）/ 超时则关单，返回最新态。 */
    @PostMapping("/recharge/orders/{orderId}/sync")
    public ApiResponse<RechargeOrderDto> syncOrder(Principal principal, @PathVariable String orderId) {
        return ApiResponse.of(paymentService.syncOrder(principal.getName(), orderId));
    }

    public record CheckoutRequest(String packageId, String wayCode, String openid, String sourceApp) {}
}
