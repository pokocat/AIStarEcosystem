package com.aistareco.aep.service.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WechatPublicKeyNotificationTest {
    private static final String API_KEY = "0123456789abcdef0123456789abcdef";
    private static String pem(String type, byte[] b) {
        return "-----BEGIN " + type + "-----\n" + Base64.getMimeEncoder(64, new byte[]{10}).encodeToString(b) + "\n-----END " + type + "-----";
    }
    private static String body(String app, String mch) throws Exception {
        var om = new ObjectMapper();
        String tx = om.writeValueAsString(Map.of("appid", app, "mchid", mch, "out_trade_no", "ro-test", "transaction_id", "wx-trade",
                "trade_state", "SUCCESS", "amount", Map.of("total", 9900, "currency", "CNY")));
        var c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(API_KEY.getBytes(StandardCharsets.UTF_8), "AES"), new GCMParameterSpec(128, "abcdefghijkl".getBytes(StandardCharsets.UTF_8)));
        c.updateAAD("transaction".getBytes(StandardCharsets.UTF_8));
        return om.writeValueAsString(Map.of("id", "event-test", "event_type", "TRANSACTION.SUCCESS", "resource_type", "encrypt-resource", "resource",
                Map.of("algorithm", "AEAD_AES_256_GCM", "nonce", "abcdefghijkl", "associated_data", "transaction",
                        "ciphertext", Base64.getEncoder().encodeToString(c.doFinal(tx.getBytes(StandardCharsets.UTF_8))))));
    }
    private static String sign(PrivateKey key, String ts, String b) throws Exception {
        var s = Signature.getInstance("SHA256withRSA"); s.initSign(key);
        s.update((ts + "\nnonce\n" + b + "\n").getBytes(StandardCharsets.UTF_8)); return Base64.getEncoder().encodeToString(s.sign());
    }
    @Test void realSignatureAndAesDecryptionRequireMatchingMerchantAndApp() throws Exception {
        var generator = KeyPairGenerator.getInstance("RSA"); generator.initialize(2048);
        var merchant = generator.generateKeyPair(); var platform = generator.generateKeyPair();
        var cfg = mock(PaymentChannelConfigService.class);
        when(cfg.version("wechat")).thenReturn(1);
        when(cfg.credentials("wechat")).thenReturn(Map.of("mchId", "mch-test", "appId", "wx-test", "apiV3Key", API_KEY,
                "merchantPrivateKey", pem("PRIVATE KEY", merchant.getPrivate().getEncoded()), "merchantSerialNumber", "123456",
                "notifyUrl", "https://example.test/api/pay/notify/wechat", "publicKeyId", "PUB_KEY_ID_TEST",
                "publicKey", pem("PUBLIC KEY", platform.getPublic().getEncoded())));
        var gw = new WechatPaymentGateway(cfg, new ObjectMapper()); String ts = Long.toString(java.time.Instant.now().getEpochSecond());
        String b = body("wx-test", "mch-test"), signature = sign(platform.getPrivate(), ts, b);
        var result = gw.parseNotify("PUB_KEY_ID_TEST", "nonce", signature, ts, "WECHATPAY2-SHA256-RSA2048", b);
        assertTrue(result.valid()); assertTrue(result.paid()); assertEquals(9900, result.amountFen());
        assertFalse(gw.parseNotify("PUB_KEY_ID_TEST", "nonce", signature, ts, "WECHATPAY2-SHA256-RSA2048", b + " ").valid());
        for (String foreign : List.of(body("wrong-app", "mch-test"), body("wx-test", "wrong-merchant"))) {
            assertFalse(gw.parseNotify("PUB_KEY_ID_TEST", "nonce", sign(platform.getPrivate(), ts, foreign), ts, "WECHATPAY2-SHA256-RSA2048", foreign).valid());
        }
    }
}
