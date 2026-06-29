package com.aistareco.aep.service.payment;

import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 支付网关注册表（v0.94 多渠道）。Spring 注入所有 {@link PaymentGateway} bean，按 driverName 建索引。
 *
 * <p>取代老的「@ConditionalOnProperty 启动选唯一 driver bean」：现在所有网关都注册，运行时由
 * {@link com.aistareco.aep.service.PaymentService} 按订单 / admin 配置选渠道，从而支持「多渠道并存、
 * 用户收银台自选 + admin 后台运行时启停」。
 */
@Component
public class PaymentGatewayRegistry {

    private final Map<String, PaymentGateway> byCode = new LinkedHashMap<>();

    public PaymentGatewayRegistry(List<PaymentGateway> gateways) {
        for (PaymentGateway g : gateways) {
            byCode.put(g.driverName(), g);
        }
    }

    /** 取网关；无对应实现 → 503（渠道未上线 / 未注册）。 */
    public PaymentGateway require(String code) {
        PaymentGateway g = byCode.get(code);
        if (g == null) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_CHANNEL_UNAVAILABLE",
                    "支付渠道暂不可用：" + code);
        }
        return g;
    }

    /** 取网关，无则 null（对账 / 查单按订单渠道路由，找不到就跳过）。 */
    public PaymentGateway get(String code) {
        return byCode.get(code);
    }

    public boolean has(String code) {
        return byCode.containsKey(code);
    }
}
