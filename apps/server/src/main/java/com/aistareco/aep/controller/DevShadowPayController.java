package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

/**
 * 影子模拟收银台确认端点（v2 §6.7）。
 *
 * §8.0 门禁：**仅当 {@code aep.payment.shadow.enabled=true}（dev 默认）时注册为 bean**（生产置 false → 此 bean 不存在）。
 * 路径 /api/dev/pay/shadow/** 未被安全规则匹配 → 落 permitAll（dev 工具，无需鉴权）。
 *
 * 合成「支付成功」回调 → 复用与渠道 notify / 手工核准同一条入账核心 {@link RechargeService#settlePaidOrder}。
 */
@RestController
@RequestMapping("/api/dev/pay/shadow")
@ConditionalOnProperty(name = "aep.payment.shadow.enabled", havingValue = "true", matchIfMissing = true)
public class DevShadowPayController {

    private static final Logger log = LoggerFactory.getLogger(DevShadowPayController.class);

    private final RechargeService rechargeService;

    public DevShadowPayController(RechargeService rechargeService) {
        this.rechargeService = rechargeService;
    }

    /**
     * result: success（默认 → settlePaidOrder 入账）/ fail（→ 取消）/ timeout（留 PENDING，交对账兜底）。
     */
    @PostMapping("/confirm")
    public ApiResponse<RechargeOrderDto> confirm(Principal principal,
                                                 @RequestBody(required = false) ShadowConfirmRequest req) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "请先登录");
        }
        if (req == null || req.orderId() == null || req.orderId().isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ORDER_ID_REQUIRED", "缺少 orderId");
        }
        // 归属校验：只允许确认自己的订单（防 orderId 枚举越权入账；shadow 也可能跑在共享 staging）。
        RechargeOrderDto order = rechargeService.getOrder(req.orderId());
        if (!principal.getName().equals(order.userId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "充值订单不存在");
        }
        String result = (req.result() == null || req.result().isBlank()) ? "success" : req.result().trim();
        log.info("[pay][shadow] confirm orderId={} userId={} result={}", req.orderId(), principal.getName(), result);
        return switch (result) {
            case "success" -> ApiResponse.of(rechargeService.settlePaidOrder(
                    req.orderId(), "shadow", "SHADOW-" + req.orderId(), null, null));
            case "fail" -> ApiResponse.of(rechargeService.cancelForGatewayError(
                    req.orderId(), "影子模拟支付失败"));
            default -> ApiResponse.of(order); // timeout → 留 PENDING
        };
    }

    public record ShadowConfirmRequest(String orderId, String result) {}
}
