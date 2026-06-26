package com.aistareco.aep.service.payment;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * 影子支付网关（v2 §6.7）—— 无支付对接也能端到端跑通。
 *
 * 只伪造「真钱渠道」这一跳：createPayOrder 返回 {@code payDataType=shadow}，结算由
 * {@code /api/dev/pay/shadow/confirm} 推动 → 复用同一个 {@code settlePaidOrder} 入账核心。
 *
 * §8.0 双控门禁：
 *   - 仅当 {@code aep.payment.driver=shadow}（dev 默认）时注入；driver=jeepay 失败绝不回退到此。
 *   - 在 mysql/prod profile 激活会打 ERROR 横幅（照 LocalFakeCdnUploader / MockPaymentGateway）。
 */
@Component
@ConditionalOnProperty(name = "aep.payment.driver", havingValue = "shadow", matchIfMissing = true)
public class ShadowPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(ShadowPaymentGateway.class);

    private final Environment env;

    public ShadowPaymentGateway(Environment env) {
        this.env = env;
    }

    @PostConstruct
    void warnIfProdProfile() {
        for (String p : env.getActiveProfiles()) {
            if ("mysql".equalsIgnoreCase(p) || "prod".equalsIgnoreCase(p)) {
                log.error("==================== 影子支付网关在生产 profile（{}）下激活 ====================", p);
                log.error("  aep.payment.driver=shadow 仅供 dev/test/staging 端到端联调，生产必须 jeepay。");
                log.error("  影子链路不产生真实资金、不可对账，线上巡检应视此为部署事故（v2 §6.7 / §8.0 P1）。");
                log.error("=======================================================================");
            }
        }
    }

    @Override
    public PayCreateResult createPayOrder(PayCreateCommand cmd) {
        String payOrderId = "shadow_" + cmd.mchOrderNo();
        log.info("[pay][shadow] createPayOrder mchOrderNo={} amountCents={} wayCode={}",
                cmd.mchOrderNo(), cmd.amountCents(), cmd.wayCode());
        // payData = 商户订单号；前端识别 payDataType=shadow → 渲染模拟收银台。
        return new PayCreateResult(payOrderId, "shadow", cmd.mchOrderNo());
    }

    @Override
    public PayQueryResult queryPayOrder(String mchOrderNo) {
        // 影子无外部支付态；结算由 confirm 端点推动，查单仅返回「存在·未支付」。
        return new PayQueryResult(true, false, "shadow_" + mchOrderNo, 0L, null);
    }

    @Override
    public String driverName() {
        return "shadow";
    }
}
