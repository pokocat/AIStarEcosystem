package com.aistareco.aep.controller;

import com.aistareco.aep.dto.RechargeOrderDto;
import com.aistareco.aep.service.RechargeService;
import com.aistareco.aep.service.payment.JeepaySignUtil;
import com.aistareco.aep.service.payment.PaymentProperties;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Jeepay 异步支付回调（v2 §6.4 触点②）。仅 driver=jeepay 注册（dev/shadow 下不存在，路径 404）。
 *
 * 安全模型（§6.4 触点④）：路径在 {@code AepSecurityConfig} permitAll —— <b>靠验签不靠 JWT</b>。
 * 金额 / 状态只信此服务端通道（returnUrl 浏览器侧绝不用于入账）。
 *
 * 流程：验签 → 取 state/mchOrderNo/amount → 载单 → 校验 state==2 && amount 匹配 →
 * 复用 {@link RechargeService#settlePaidOrder}（条件 UPDATE 幂等，重复回调 no-op）→ 返回纯文本 "success"。
 * 任一不符 → 不入账；可重试的情形返回非 success 让 Jeepay 重投，止重试的情形返回 success。
 */
@RestController
@RequestMapping("/api/pay/notify")
@ConditionalOnProperty(name = "aep.payment.driver", havingValue = "jeepay")
public class PayNotifyController {

    private static final Logger log = LoggerFactory.getLogger(PayNotifyController.class);
    private static final String OK = "success";
    private static final String FAIL = "fail";

    private final RechargeService rechargeService;
    private final PaymentProperties props;

    public PayNotifyController(RechargeService rechargeService, PaymentProperties props) {
        this.rechargeService = rechargeService;
        this.props = props;
    }

    @PostMapping(value = "/jeepay", produces = MediaType.TEXT_PLAIN_VALUE)
    public String jeepayNotify(@RequestBody(required = false) Map<String, Object> params) {
        if (params == null || params.isEmpty()) {
            log.warn("[pay][jeepay-notify] 空回调体");
            return FAIL;
        }
        // 1) 验签（失败 → 非 success，拒绝处理）
        String sign = str(params.get("sign"));
        if (!JeepaySignUtil.verify(params, props.getJeepay().getApiKey(), sign)) {
            log.warn("[pay][jeepay-notify] 验签失败 mchOrderNo={}", params.get("mchOrderNo"));
            return FAIL;
        }

        String mchOrderNo = str(params.get("mchOrderNo"));
        int state = asInt(params.get("state"), asInt(params.get("orderState"), -1));
        long amount = asLong(params.get("amount"), -1);
        String channelOrderNo = str(params.get("channelOrderNo"));

        // 2) 载单（不存在 → 返回 success 止重投 + 告警）
        RechargeOrderDto order;
        try {
            order = rechargeService.getOrder(mchOrderNo);
        } catch (BusinessException notFound) {
            log.warn("[pay][jeepay-notify] 订单不存在 mchOrderNo={}（返回 success 止重投）", mchOrderNo);
            return OK;
        }

        // 3) 非成功态 → 无需入账（返回 success，Jeepay 不再重投本通知）
        if (state != 2) {
            log.info("[pay][jeepay-notify] 非成功态 state={} mchOrderNo={}", state, mchOrderNo);
            return OK;
        }

        // 4) 金额校验（不符 → 不入账 + 告警 + 非 success，绝不按渠道金额入账）
        if (amount != order.priceCents()) {
            log.error("[pay][jeepay-notify] 金额不符 mchOrderNo={} notifyAmount={} orderPriceCents={}（拒绝入账）",
                    mchOrderNo, amount, order.priceCents());
            return FAIL;
        }

        // 5) 结算（幂等：markPaid 条件 UPDATE，重复回调 no-op）
        rechargeService.settlePaidOrder(mchOrderNo, "jeepay", channelOrderNo, null, null);
        log.info("[pay][jeepay-notify] settled mchOrderNo={} amount={} channelOrderNo={}",
                mchOrderNo, amount, channelOrderNo);
        return OK;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static int asInt(Object o, int dft) {
        if (o == null) return dft;
        try {
            return Integer.parseInt(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }

    private static long asLong(Object o, long dft) {
        if (o == null) return dft;
        try {
            return Long.parseLong(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }
}
