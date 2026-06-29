package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.AlipayPaymentGateway;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 支付宝异步支付回调（v2 §6.4 触点②，直连方案）。v0.94 起常驻注册（多渠道运行时启停）：
 * 支付宝未启用 / 未配置时 verifyNotify 返回 false → 回 fail，不入账。
 *
 * 安全模型（§6.4 触点④）：路径在 {@code AepSecurityConfig} permitAll —— <b>靠 RSA2 验签不靠 JWT</b>。
 * 金额 / 状态只信此服务端通道（returnUrl 浏览器同步跳回绝不用于入账）。
 *
 * 流程：{@code Factory.Payment.Common().verifyNotify} 验签 → 校验 trade_status 成功 + total_amount 匹配 →
 * 复用 {@link RechargeService#settlePaidOrder}（条件 UPDATE 幂等,重复回调 / 与查单兜底并发都只入账一次）
 * → 返回纯文本 "success"（支付宝据此止重投）。任一不符 → 不入账,返回 "fail" 让支付宝重投或人工查。
 */
@RestController
@RequestMapping("/api/pay/notify")
public class AlipayNotifyController {

    private static final Logger log = LoggerFactory.getLogger(AlipayNotifyController.class);
    private static final String OK = "success";
    private static final String FAIL = "fail";

    private final RechargeService rechargeService;
    private final AlipayPaymentGateway gateway;

    public AlipayNotifyController(RechargeService rechargeService, AlipayPaymentGateway gateway) {
        this.rechargeService = rechargeService;
        this.gateway = gateway;
    }

    @PostMapping(value = "/alipay", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE,
            produces = MediaType.TEXT_PLAIN_VALUE)
    public String alipayNotify(@RequestParam Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            log.warn("[pay][alipay-notify] 空回调体");
            return FAIL;
        }
        String outTradeNo = params.get("out_trade_no");

        // 1) RSA2 验签（SDK 边界在 gateway；失败 → fail，拒绝处理）
        if (!gateway.verifyNotify(params)) {
            log.warn("[pay][alipay-notify] 验签失败 outTradeNo={}", outTradeNo);
            return FAIL;
        }

        String tradeStatus = params.get("trade_status");
        String tradeNo = params.get("trade_no");

        // 2) 载单（不存在 → success 止重投 + 告警）
        RechargeOrderDto order;
        try {
            order = rechargeService.getOrder(outTradeNo);
        } catch (BusinessException notFound) {
            log.warn("[pay][alipay-notify] 订单不存在 outTradeNo={}（返回 success 止重投）", outTradeNo);
            return OK;
        }

        // 3) 非成功态 → 无需入账（返回 success,支付宝不再重投本通知）
        if (!"TRADE_SUCCESS".equals(tradeStatus) && !"TRADE_FINISHED".equals(tradeStatus)) {
            log.info("[pay][alipay-notify] 非成功态 tradeStatus={} outTradeNo={}", tradeStatus, outTradeNo);
            return OK;
        }

        // 4) 金额校验（total_amount 单位元 → 分;不符则不入账,绝不按渠道金额入账）
        long notifyCents;
        try {
            notifyCents = Math.round(Double.parseDouble(params.get("total_amount")) * 100);
        } catch (NumberFormatException e) {
            log.error("[pay][alipay-notify] total_amount 非法 outTradeNo={} raw={}", outTradeNo, params.get("total_amount"));
            return FAIL;
        }
        if (notifyCents != order.priceCents()) {
            log.error("[pay][alipay-notify] 金额不符 outTradeNo={} notifyCents={} orderPriceCents={}（拒绝入账）",
                    outTradeNo, notifyCents, order.priceCents());
            return FAIL;
        }

        // 5) 结算（幂等：markPaid 条件 UPDATE,重复回调 / 与查单兜底并发都只入账一次）
        rechargeService.settlePaidOrder(outTradeNo, "alipay", tradeNo, null, null);
        log.info("[pay][alipay-notify] settled outTradeNo={} cents={} tradeNo={}", outTradeNo, notifyCents, tradeNo);
        return OK;
    }
}
