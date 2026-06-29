package com.aistareco.aep.service.payment;

import com.aistareco.aep.dto.AdminPaymentChannelUpsertDto;
import com.aistareco.aep.dto.PaymentChannelConfigDto;
import com.aistareco.aep.model.PaymentChannelConfig;
import com.aistareco.aep.repository.PaymentChannelConfigRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * {@link PaymentChannelConfigService}：机密加解密 round-trip / upsert 合并语义（空=保留、__CLEAR__=清空）/
 * 启用前必填校验 / admin 视图脱敏。用内存 map 背书仓库。
 */
class PaymentChannelConfigServiceTest {

    private Map<String, PaymentChannelConfig> store;
    private PaymentChannelConfigService svc;

    private static Map<String, String> alipayFull() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("appId", "2021000000000000");
        m.put("merchantPrivateKey", "PRIV_KEY_LONG_ENOUGH");
        m.put("alipayPublicKey", "PUB_KEY_LONG_ENOUGH");
        m.put("gatewayHost", "openapi.alipay.com");
        m.put("notifyUrl", "https://x/api/pay/notify/alipay");
        return m;
    }

    @BeforeEach
    void setup() {
        store = new HashMap<>();
        PaymentChannelConfigRepository repo = mock(PaymentChannelConfigRepository.class);
        when(repo.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(store.get(inv.<String>getArgument(0))));
        when(repo.existsById(anyString())).thenAnswer(inv -> store.containsKey(inv.<String>getArgument(0)));
        when(repo.save(any(PaymentChannelConfig.class))).thenAnswer(inv -> {
            PaymentChannelConfig c = inv.getArgument(0);
            store.put(c.getCode(), c);
            return c;
        });
        svc = new PaymentChannelConfigService(repo, new ObjectMapper());
    }

    private AdminPaymentChannelUpsertDto upsert(Boolean enabled, Map<String, String> creds) {
        return new AdminPaymentChannelUpsertDto(enabled, null, null, null, null, creds);
    }

    @Test
    void credentialsRoundTripThroughEncryption() {
        svc.upsert("alipay", upsert(false, alipayFull()), "tester");
        Map<String, String> got = svc.credentials("alipay");
        assertEquals("2021000000000000", got.get("appId"));
        assertEquals("PRIV_KEY_LONG_ENOUGH", got.get("merchantPrivateKey"));
        // 落库的是密文，不是明文
        assertNotNull(store.get("alipay").getCredsEncrypted());
        assertFalse(store.get("alipay").getCredsEncrypted().contains("2021000000000000"));
    }

    @Test
    void blankFieldKeepsExistingSecret() {
        svc.upsert("alipay", upsert(false, alipayFull()), "tester");
        // 只更新 appId，其余留空 → 旧值保留
        Map<String, String> partial = new HashMap<>();
        partial.put("appId", "2099999999999999");
        partial.put("merchantPrivateKey", "");
        svc.upsert("alipay", upsert(false, partial), "tester");
        Map<String, String> got = svc.credentials("alipay");
        assertEquals("2099999999999999", got.get("appId"));
        assertEquals("PRIV_KEY_LONG_ENOUGH", got.get("merchantPrivateKey")); // 留空保留
    }

    @Test
    void clearTokenRemovesField() {
        svc.upsert("alipay", upsert(false, alipayFull()), "tester");
        Map<String, String> clear = new HashMap<>();
        clear.put("returnUrl", PaymentChannelConfigService.CLEAR_TOKEN);
        // returnUrl 本来没设；先设再清
        Map<String, String> setReturn = new HashMap<>();
        setReturn.put("returnUrl", "https://x/back");
        svc.upsert("alipay", upsert(false, setReturn), "tester");
        assertEquals("https://x/back", svc.credentials("alipay").get("returnUrl"));
        svc.upsert("alipay", upsert(false, clear), "tester");
        assertNull(svc.credentials("alipay").get("returnUrl"));
    }

    @Test
    void enablingWithIncompleteCredsRejected() {
        assertThrows(BusinessException.class, () -> svc.upsert("wechat", upsert(true, Map.of()), "tester"));
    }

    @Test
    void listForAdminMasksSecretsAndReportsConfigured() {
        svc.upsert("alipay", upsert(true, alipayFull()), "tester");
        PaymentChannelConfigDto dto = svc.listForAdmin().stream()
                .filter(d -> d.code().equals("alipay")).findFirst().orElseThrow();
        assertTrue(dto.configured());
        assertTrue(dto.enabled());
        // 脱敏：不含明文，含掩码
        String masked = dto.creds().get("appId");
        assertNotEquals("2021000000000000", masked);
        assertFalse(masked.isBlank());
        // 未配置渠道（wechat）也列出，creds 为空串
        PaymentChannelConfigDto wx = svc.listForAdmin().stream()
                .filter(d -> d.code().equals("wechat")).findFirst().orElseThrow();
        assertFalse(wx.configured());
        assertEquals("", wx.creds().get("mchId"));
    }

    @Test
    void unknownChannelRejected() {
        assertThrows(BusinessException.class, () -> svc.upsert("paypal", upsert(false, Map.of()), "tester"));
    }
}
