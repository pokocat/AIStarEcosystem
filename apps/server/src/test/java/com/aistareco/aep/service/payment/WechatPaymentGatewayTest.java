package com.aistareco.aep.service.payment;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * {@link WechatPaymentGateway} §8.0 运行时 fail-fast（v0.94）：渠道机密缺任一必填 → 下单期抛
 * 503 PAYMENT_CHANNEL_NOT_CONFIGURED（在构建 SDK 之前，绝不带半配置下单）。
 */
class WechatPaymentGatewayTest {

    private PaymentChannelConfigService cfg;
    private WechatPaymentGateway gw;

    @BeforeEach
    void setup() {
        cfg = mock(PaymentChannelConfigService.class);
        when(cfg.version("wechat")).thenReturn(1);
        gw = new WechatPaymentGateway(cfg, new ObjectMapper());
    }

    private static Map<String, String> full() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("mchId", "1600000000");
        m.put("appId", "wx1234567890");
        m.put("apiV3Key", "0123456789abcdef0123456789abcdef");
        m.put("merchantPrivateKey", "FAKE_PRIVATE_KEY");
        m.put("merchantSerialNumber", "ABCDEF0123456789");
        m.put("notifyUrl", "https://x/api/pay/notify/wechat");
        return m;
    }

    private BusinessException createWith(Map<String, String> creds) {
        when(cfg.credentials("wechat")).thenReturn(creds);
        return assertThrows(BusinessException.class,
                () -> gw.createPayOrder(new PayCreateCommand("ro-1", 9900, "WX_NATIVE", "积分充值", null, null)));
    }

    @Test
    void missingMchIdFailsFast() {
        Map<String, String> m = full();
        m.remove("mchId");
        assertTrue(createWith(m).getMessage().contains("mchId"));
    }

    @Test
    void missingApiV3KeyFailsFast() {
        Map<String, String> m = full();
        m.put("apiV3Key", "  ");
        assertTrue(createWith(m).getMessage().contains("apiV3Key"));
    }

    @Test
    void missingMerchantSerialFailsFast() {
        Map<String, String> m = full();
        m.remove("merchantSerialNumber");
        assertTrue(createWith(m).getMessage().contains("merchantSerialNumber"));
    }

    @Test
    void driverNameIsWechat() {
        assertEquals("wechat", gw.driverName());
    }

    @Test
    void isConfiguredDelegatesToChannelConfig() {
        when(cfg.isConfigured("wechat")).thenReturn(true);
        assertTrue(gw.isConfigured());
    }
}
