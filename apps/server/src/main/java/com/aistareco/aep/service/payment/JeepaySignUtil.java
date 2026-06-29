package com.aistareco.aep.service.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.TreeMap;

/**
 * Jeepay MD5 签名（v2 §6.4）。与 Jeepay {@code JeequanKit/JeepayKit.getSign} 算法一致：
 *   1. 参数按 key 的 ASCII 升序排序；
 *   2. 跳过 {@code sign} 字段与空值；
 *   3. 拼成 {@code k1=v1&k2=v2&...&kn=vn}；
 *   4. 末尾追加 {@code &key=<apiKey>}；
 *   5. 整串 MD5（UTF-8）→ 转大写十六进制。
 *
 * 出 wire 下单与收回调验签共用同一算法。签名密钥（apiKey）绝不进 git / 日志。
 *
 * <p><b>注</b>：本类算法与格式有单测固定（{@link JeepaySignUtilTest}），但与<b>真实 Jeepay 实例</b>
 * 的端到端互验需待实例就绪（§13#6 决策项）。
 */
public final class JeepaySignUtil {

    private JeepaySignUtil() {}

    /** 计算签名（大写 32 位十六进制 MD5）。 */
    public static String sign(Map<String, ?> params, String apiKey) {
        return md5Upper(canonicalString(params, apiKey));
    }

    /** 验签：用同算法重算并大小写无关比较。providedSign 为空 → false。 */
    public static boolean verify(Map<String, ?> params, String apiKey, String providedSign) {
        if (providedSign == null || providedSign.isBlank()) {
            return false;
        }
        return sign(params, apiKey).equalsIgnoreCase(providedSign.trim());
    }

    /**
     * 待签名规范串（MD5 之前）。抽出供测试精确固定格式 —— 这是与 Jeepay 互通的关键。
     * 排序 + 跳过 sign/空值 + 末尾 {@code &key=<apiKey>}。
     */
    static String canonicalString(Map<String, ?> params, String apiKey) {
        TreeMap<String, Object> sorted = new TreeMap<>();
        for (Map.Entry<String, ?> e : params.entrySet()) {
            sorted.put(e.getKey(), e.getValue());
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, Object> e : sorted.entrySet()) {
            String k = e.getKey();
            Object v = e.getValue();
            if ("sign".equals(k)) continue;
            if (v == null) continue;
            String vs = String.valueOf(v);
            if (vs.isEmpty()) continue;
            sb.append(k).append('=').append(vs).append('&');
        }
        sb.append("key=").append(apiKey);
        return sb.toString();
    }

    private static String md5Upper(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(32);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString().toUpperCase(java.util.Locale.ROOT);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("MD5 不可用", e);
        }
    }
}
