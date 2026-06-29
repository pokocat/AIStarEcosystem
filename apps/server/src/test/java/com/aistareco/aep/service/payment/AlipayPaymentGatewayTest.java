package com.aistareco.aep.service.payment;

import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link AlipayPaymentGateway} §8.0 运行时 fail-fast（v0.94）：渠道机密缺任一必填 → 下单期抛
 * 503 PAYMENT_CHANNEL_NOT_CONFIGURED（在 Factory.setOptions / SDK 调用之前，绝不带半配置下单）。
 */
class AlipayPaymentGatewayTest {

    private PaymentChannelConfigService cfg;
    private AlipayPaymentGateway gw;

    @BeforeEach
    void setup() {
        cfg = mock(PaymentChannelConfigService.class);
        when(cfg.version("alipay")).thenReturn(1);
        gw = new AlipayPaymentGateway(cfg);
    }

    private static Map<String, String> full() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("appId", "2021000000000000");
        m.put("merchantPrivateKey", "FAKE_PRIVATE_KEY");
        m.put("alipayPublicKey", "FAKE_ALIPAY_PUBLIC_KEY");
        m.put("notifyUrl", "https://x/api/pay/notify/alipay");
        m.put("gatewayHost", "openapi.alipaydev.com");
        return m;
    }

    private BusinessException createWith(Map<String, String> creds) {
        when(cfg.credentials("alipay")).thenReturn(creds);
        return assertThrows(BusinessException.class,
                () -> gw.createPayOrder(new PayCreateCommand("ro-1", 9900, "ALI_PC", "积分充值", null, null)));
    }

    @Test
    void missingAppIdFailsFast() {
        Map<String, String> m = full();
        m.remove("appId");
        assertTrue(createWith(m).getMessage().contains("appId"));
    }

    @Test
    void missingPrivateKeyFailsFast() {
        Map<String, String> m = full();
        m.put("merchantPrivateKey", "  ");
        assertTrue(createWith(m).getMessage().contains("merchantPrivateKey"));
    }

    @Test
    void missingAlipayPublicKeyFailsFast() {
        Map<String, String> m = full();
        m.remove("alipayPublicKey");
        assertTrue(createWith(m).getMessage().contains("alipayPublicKey"));
    }

    @Test
    void missingNotifyUrlFailsFast() {
        Map<String, String> m = full();
        m.remove("notifyUrl");
        assertTrue(createWith(m).getMessage().contains("notifyUrl"));
    }

    @Test
    void driverNameIsAlipay() {
        assertEquals("alipay", gw.driverName());
    }

    @Test
    void isConfiguredDelegatesToChannelConfig() {
        when(cfg.isConfigured("alipay")).thenReturn(true);
        assertTrue(gw.isConfigured());
    }
}
