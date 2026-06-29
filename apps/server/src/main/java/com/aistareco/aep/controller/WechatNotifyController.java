package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.WechatPaymentGateway;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 微信支付 V3 异步回调（v0.94 直连）。常驻注册（多渠道运行时启停）。
 *
 * 安全模型（§6.4 触点④）：路径在 {@code AepSecurityConfig} permitAll —— 靠 V3 验签 + AES-GCM 解密（SDK
 * 边界收口在 {@link WechatPaymentGateway#parseNotify}）不靠 JWT。金额 / 状态只信此服务端通道。
 *
 * 流程：验签解密 → 校验 trade_state SUCCESS + amount 匹配 → 复用 {@link RechargeService#settlePaidOrder}
 * （条件 UPDATE 幂等，重复回调 / 与查单兜底并发都只入账一次）→ 回 200 {@code {"code":"SUCCESS"}}。
 * 任一不符 → 不入账，回 5xx {@code {"code":"FAIL"}} 让微信重投。
 */
@RestController
@RequestMapping("/api/pay/notify")
public class WechatNotifyController {

    private static final Logger log = LoggerFactory.getLogger(WechatNotifyController.class);
    private static final Map<String, String> OK = Map.of("code", "SUCCESS");

    private final RechargeService rechargeService;
    private final WechatPaymentGateway gateway;

    public WechatNotifyController(RechargeService rechargeService, WechatPaymentGateway gateway) {
        this.rechargeService = rechargeService;
        this.gateway = gateway;
    }

    @PostMapping("/wechat")
    public ResponseEntity<Map<String, String>> wechatNotify(
            @RequestHeader(value = "Wechatpay-Serial", required = false) String serial,
            @RequestHeader(value = "Wechatpay-Signature", required = false) String signature,
            @RequestHeader(value = "Wechatpay-Timestamp", required = false) String timestamp,
            @RequestHeader(value = "Wechatpay-Nonce", required = false) String nonce,
            @RequestHeader(value = "Wechatpay-Signature-Type", required = false) String signType,
            @RequestBody(required = false) String body) {

        // 1) 验签 + 解密（SDK 边界在 gateway）
        WechatPaymentGateway.NotifyResult r = gateway.parseNotify(serial, nonce, signature, timestamp, signType, body);
        if (!r.valid()) {
            log.warn("[pay][wechat-notify] 验签/解密失败 serial={}", serial);
            return fail("验签失败");
        }
        String outTradeNo = r.outTradeNo();

        // 2) 载单（不存在 → SUCCESS 止重投 + 告警）
        RechargeOrderDto order;
        try {
            order = rechargeService.getOrder(outTradeNo);
        } catch (BusinessException notFound) {
            log.warn("[pay][wechat-notify] 订单不存在 outTradeNo={}（返回 SUCCESS 止重投）", outTradeNo);
            return ResponseEntity.ok(OK);
        }

        // 3) 非成功态 → 无需入账（返回 SUCCESS，微信不再重投本通知）
        if (!r.paid()) {
            log.info("[pay][wechat-notify] 非成功态 outTradeNo={}", outTradeNo);
            return ResponseEntity.ok(OK);
        }

        // 4) 金额校验（单位分；不符则不入账，绝不按渠道金额入账）
        if (r.amountFen() != order.priceCents()) {
            log.error("[pay][wechat-notify] 金额不符 outTradeNo={} notifyFen={} orderPriceCents={}（拒绝入账）",
                    outTradeNo, r.amountFen(), order.priceCents());
            return fail("金额不符");
        }

        // 5) 结算（幂等：markPaid 条件 UPDATE，重复回调 / 与查单兜底并发都只入账一次）
        rechargeService.settlePaidOrder(outTradeNo, "wechat", r.transactionId(), null, null);
        log.info("[pay][wechat-notify] settled outTradeNo={} fen={} transactionId={}",
                outTradeNo, r.amountFen(), r.transactionId());
        return ResponseEntity.ok(OK);
    }

    private static ResponseEntity<Map<String, String>> fail(String msg) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("code", "FAIL", "message", msg));
    }
}
