package com.aistareco.aep.service.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Jeepay 驱动 §8.0 启动 fail-fast：缺关键配置 / 非 MD5 → 拒绝启动（绝不带半套配置上线）。
 */
class JeepayPaymentGatewayTest {

    private JeepayPaymentGateway gateway(PaymentProperties.Jeepay j) {
        PaymentProperties props = new PaymentProperties();
        props.setJeepay(j);
        return new JeepayPaymentGateway(props, new ObjectMapper());
    }

    private PaymentProperties.Jeepay fullConfig() {
        PaymentProperties.Jeepay j = new PaymentProperties.Jeepay();
        j.setBaseUrl("https://pay.example.com");
        j.setMchNo("M1");
        j.setAppId("A1");
        j.setApiKey("k1");
        j.setNotifyUrl("https://api.example.com/api/pay/notify/jeepay");
        return j;
    }

    @Test
    void failsFastWhenApiKeyMissing() {
        PaymentProperties.Jeepay j = fullConfig();
        j.setApiKey(null);
        assertThrows(IllegalStateException.class, () -> gateway(j).validateConfig());
    }

    @Test
    void failsFastWhenBaseUrlBlank() {
        PaymentProperties.Jeepay j = fullConfig();
        j.setBaseUrl("  ");
        assertThrows(IllegalStateException.class, () -> gateway(j).validateConfig());
    }

    @Test
    void failsFastWhenSignTypeNotMd5() {
        PaymentProperties.Jeepay j = fullConfig();
        j.setSignType("RSA2");
        assertThrows(IllegalStateException.class, () -> gateway(j).validateConfig());
    }

    @Test
    void acceptsFullValidConfig() {
        assertDoesNotThrow(() -> gateway(fullConfig()).validateConfig());
        assertEquals("jeepay", gateway(fullConfig()).driverName());
    }
}
