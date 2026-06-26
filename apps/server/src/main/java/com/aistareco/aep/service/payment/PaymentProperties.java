package com.aistareco.aep.service.payment;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 支付配置（v2 §6.5）。{@code aep.payment.*}。
 */
@Component
@ConfigurationProperties(prefix = "aep.payment")
@Data
public class PaymentProperties {

    /** shadow（dev/test/staging）/ jeepay（生产）。 */
    private String driver = "shadow";

    private Shadow shadow = new Shadow();
    private Jeepay jeepay = new Jeepay();

    @Data
    public static class Shadow {
        /** manual=前端模拟收银台手动确认；auto=下单后延迟自动确认（CI/headless）。 */
        private String confirmMode = "manual";
        /** auto 模式下单后多少毫秒自动判成功。 */
        private long autoConfirmDelayMs = 800;
    }

    /**
     * Jeepay 自部署聚合支付网关配置（v2 §6.5）。机密经 env 注入、禁进 git。
     * driver=jeepay 时这些必填（{@link JeepayPaymentGateway} 启动 fail-fast 校验，守 §8.0）。
     */
    @Data
    public static class Jeepay {
        /** jeepay-payment 网关地址，如 https://pay.example.com。 */
        private String baseUrl;
        /** 商户号。 */
        private String mchNo;
        /** 应用 ID。 */
        private String appId;
        /** 签名密钥（apiKey）。 */
        private String apiKey;
        /** 我方回调地址（Jeepay 可达），如 https://api.example.com/api/pay/notify/jeepay。 */
        private String notifyUrl;
        /** 签名类型，当前仅 MD5。 */
        private String signType = "MD5";
        /** 默认支付方式（小程序 WX_LITE / 扫码 WX_NATIVE / 支付宝 ALI_QR）。 */
        private String defaultWayCode = "WX_LITE";
        /** 接口版本。 */
        private String version = "1.0";
    }
}
