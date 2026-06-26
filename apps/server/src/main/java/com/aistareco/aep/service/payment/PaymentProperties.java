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

    @Data
    public static class Shadow {
        /** manual=前端模拟收银台手动确认；auto=下单后延迟自动确认（CI/headless）。 */
        private String confirmMode = "manual";
        /** auto 模式下单后多少毫秒自动判成功。 */
        private long autoConfirmDelayMs = 800;
    }
}
