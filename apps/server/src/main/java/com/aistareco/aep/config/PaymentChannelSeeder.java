package com.aistareco.aep.config;

import com.aistareco.aep.service.payment.PaymentChannelConfigService;
import com.aistareco.aep.service.payment.PaymentProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 支付渠道 bootstrap 种子（v0.94）：把旧的 env 渠道凭据（{@link PaymentProperties}）在首次启动迁进
 * DB（{@code aep_payment_channels}），让既有「env 固定 driver=alipay + 凭据」部署平滑过渡到运行时配置。
 *
 * <p>幂等：仅在 DB 尚无该渠道行时种（{@code seedFromEnvIfAbsent}），绝不覆盖 admin 后台改过的值。
 * 启用条件：env driver 选中该渠道（或凭据齐全）。之后一切以 admin 后台「支付配置」为准。
 */
@Component
@Order(59)
public class PaymentChannelSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PaymentChannelSeeder.class);

    private final PaymentChannelConfigService channelConfig;
    private final PaymentProperties props;

    public PaymentChannelSeeder(PaymentChannelConfigService channelConfig, PaymentProperties props) {
        this.channelConfig = channelConfig;
        this.props = props;
    }

    @Override
    public void run(String... args) {
        PaymentProperties.Alipay a = props.getAlipay();
        if (a != null && a.getAppId() != null && !a.getAppId().isBlank()) {
            Map<String, String> creds = new LinkedHashMap<>();
            put(creds, "appId", a.getAppId());
            put(creds, "merchantPrivateKey", a.getMerchantPrivateKey());
            put(creds, "alipayPublicKey", a.getAlipayPublicKey());
            put(creds, "gatewayHost", a.getGatewayHost());
            put(creds, "notifyUrl", a.getNotifyUrl());
            put(creds, "returnUrl", a.getReturnUrl());
            put(creds, "signType", a.getSignType());
            put(creds, "protocol", a.getProtocol());
            boolean enable = "alipay".equalsIgnoreCase(props.getDriver());
            channelConfig.seedFromEnvIfAbsent("alipay", enable, creds, "支付宝",
                    a.getDefaultWayCode(), a.isSandbox());
            log.info("[pay][seed] alipay channel bootstrap from env attempted (enableHint={})", enable);
        }
        // 微信渠道（wechat）无 env bootstrap —— 直接在 admin 后台「支付配置」填机密启用。
    }

    private static void put(Map<String, String> m, String k, String v) {
        if (v != null && !v.isBlank()) m.put(k, v);
    }
}
