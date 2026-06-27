package com.aistareco.aep.service.payment;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link AlipayPaymentGateway} 启动期 §8.0 fail-fast：driver=alipay 缺任一凭证 → 拒绝启动
 * （在 Factory.setOptions 之前抛,绝不带半配置跑）。
 */
class AlipayPaymentGatewayTest {

    private static PaymentProperties.Alipay full() {
        PaymentProperties.Alipay a = new PaymentProperties.Alipay();
        a.setAppId("2021000000000000");
        a.setMerchantPrivateKey("FAKE_PRIVATE_KEY");
        a.setAlipayPublicKey("FAKE_ALIPAY_PUBLIC_KEY");
        a.setNotifyUrl("https://x/api/pay/notify/alipay");
        a.setGatewayHost("openapi.alipaydev.com");
        return a;
    }

    private static IllegalStateException initWith(PaymentProperties.Alipay a) {
        PaymentProperties props = new PaymentProperties();
        props.setAlipay(a);
        AlipayPaymentGateway gw = new AlipayPaymentGateway(props);
        return assertThrows(IllegalStateException.class, gw::init);
    }

    @Test
    void missingAppIdFailsFast() {
        PaymentProperties.Alipay a = full();
        a.setAppId(null);
        assertTrue(initWith(a).getMessage().contains("app-id"));
    }

    @Test
    void missingPrivateKeyFailsFast() {
        PaymentProperties.Alipay a = full();
        a.setMerchantPrivateKey("  ");
        assertTrue(initWith(a).getMessage().contains("merchant-private-key"));
    }

    @Test
    void missingAlipayPublicKeyFailsFast() {
        PaymentProperties.Alipay a = full();
        a.setAlipayPublicKey(null);
        assertTrue(initWith(a).getMessage().contains("alipay-public-key"));
    }

    @Test
    void missingNotifyUrlFailsFast() {
        PaymentProperties.Alipay a = full();
        a.setNotifyUrl(null);
        assertTrue(initWith(a).getMessage().contains("notify-url"));
    }

    @Test
    void driverNameIsAlipay() {
        assertEquals("alipay", new AlipayPaymentGateway(new PaymentProperties()).driverName());
    }
}
