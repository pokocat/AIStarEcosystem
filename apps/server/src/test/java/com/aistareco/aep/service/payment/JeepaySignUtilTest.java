package com.aistareco.aep.service.payment;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Jeepay MD5 签名（v2 §6.4）：规范串格式（与 Jeepay 互通的关键）+ 验签 round-trip + 顺序无关 + 防篡改。
 */
class JeepaySignUtilTest {

    @Test
    void canonicalStringSortsSkipsSignAndEmptyAppendsKey() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("mchNo", "M1");
        p.put("amount", "100");
        p.put("appId", "A1");
        p.put("sign", "SHOULD_BE_IGNORED");
        p.put("empty", "");        // 空值跳过
        p.put("nullv", null);       // null 跳过
        // 排序后：amount, appId, mchNo（跳过 sign/empty/nullv），末尾 &key=
        assertEquals("amount=100&appId=A1&mchNo=M1&key=secret",
                JeepaySignUtil.canonicalString(p, "secret"));
    }

    @Test
    void signIs32HexUppercaseAndDeterministic() {
        Map<String, Object> p = Map.of("mchNo", "M1", "amount", "100");
        String s = JeepaySignUtil.sign(p, "secret");
        assertEquals(32, s.length());
        assertTrue(s.matches("[0-9A-F]{32}"), "应为 32 位大写十六进制：" + s);
        assertEquals(s, JeepaySignUtil.sign(p, "secret"), "确定性");
    }

    @Test
    void signIsOrderIndependent() {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("appId", "A1"); a.put("mchNo", "M1"); a.put("amount", "100");
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("amount", "100"); b.put("mchNo", "M1"); b.put("appId", "A1");
        assertEquals(JeepaySignUtil.sign(a, "secret"), JeepaySignUtil.sign(b, "secret"));
    }

    @Test
    void verifyAcceptsOwnSignAndRejectsTamper() {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("mchNo", "M1"); p.put("amount", "100"); p.put("state", "2");
        String sign = JeepaySignUtil.sign(p, "secret");
        p.put("sign", sign);
        assertTrue(JeepaySignUtil.verify(p, "secret", sign));
        assertTrue(JeepaySignUtil.verify(p, "secret", sign.toLowerCase()), "大小写无关");
        // 篡改金额 → 验签失败
        p.put("amount", "999");
        assertFalse(JeepaySignUtil.verify(p, "secret", sign));
        // 错误密钥 → 失败
        assertFalse(JeepaySignUtil.verify(Map.of("mchNo", "M1"), "wrong", sign));
        // 空签名 → 失败
        assertFalse(JeepaySignUtil.verify(p, "secret", null));
        assertFalse(JeepaySignUtil.verify(p, "secret", ""));
    }
}
