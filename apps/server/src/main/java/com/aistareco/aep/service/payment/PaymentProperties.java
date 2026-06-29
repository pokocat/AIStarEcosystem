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

    /** shadow（dev/test/staging）/ alipay（支付宝直连）/ jeepay（聚合，休眠）。 */
    private String driver = "shadow";

    private Shadow shadow = new Shadow();
    private Jeepay jeepay = new Jeepay();
    private Alipay alipay = new Alipay();

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

    /**
     * 支付宝直连配置（v2 §6 · 直连官方 SDK alipay-easysdk）。机密经 env 注入、禁进 git。
     * driver=alipay 时这些必填（{@code AlipayPaymentGateway} 启动 fail-fast 校验，守 §8.0）。
     * 沙箱→生产只换 appId/merchantPrivateKey/alipayPublicKey/gatewayHost 四项,业务代码零改。
     */
    @Data
    public static class Alipay {
        /** 应用 APPID（沙箱在开放平台沙箱控制台自动分配；生产为正式审核通过的应用号）。 */
        private String appId;
        /** 应用私钥（RSA2 PKCS8，自己生成；上传对应应用公钥换取支付宝公钥）。 */
        private String merchantPrivateKey;
        /** 支付宝公钥（开放平台按你的应用公钥生成）。 */
        private String alipayPublicKey;
        /** 网关 host：沙箱 openapi-sandbox.dl.alipaydev.com（旧 openapi.alipaydev.com 已废 502）/ 生产 openapi.alipay.com（接入时按控制台核对）。 */
        private String gatewayHost = "openapi-sandbox.dl.alipaydev.com";
        /** 协议，固定 https。 */
        private String protocol = "https";
        /** 签名类型，固定 RSA2。 */
        private String signType = "RSA2";
        /** 我方异步回调地址（支付宝可达，公网/隧道），如 https://xxx/api/pay/notify/alipay。 */
        private String notifyUrl;
        /** 同步跳回地址（ALI_PC/ALI_WAP 付款后浏览器跳回，可空；仅展示用，绝不据此入账）。 */
        private String returnUrl;
        /** 默认支付方式：ALI_PC（电脑网站，浏览器直接付，沙箱首选）/ ALI_WAP（手机网站）/ ALI_QR（扫码）。 */
        private String defaultWayCode = "ALI_PC";
        /** 沙箱标识，仅用于日志/横幅提示；真正切换靠 gatewayHost。 */
        private boolean sandbox = true;
    }
}
