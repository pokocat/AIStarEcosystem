package com.aistareco.aep.service.music;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * 火山引擎 OpenAPI 签名（Signature V4，HMAC-SHA256）。
 *
 * <p>与仓库其余 AI 端点不同：豆包音乐大模型走的是 {@code open.volcengineapi.com} 的
 * OpenAPI 协议，用 AK/SK 请求签名而不是 {@code Authorization: Bearer}。所以它无法复用
 * {@code AiModelInvocationService} 的 OpenAI 兼容通道，必须自己签。
 *
 * <p>签名规范：
 * <pre>
 * Authorization: HMAC-SHA256 Credential={AK}/{yyyyMMdd}/{region}/{service}/request,
 *                SignedHeaders={h1;h2;...}, Signature={hex}
 * </pre>
 * 派生密钥链：{@code SK -> date -> region -> service -> "request"}。
 *
 * <p>无状态、线程安全；不持有任何凭据，AK/SK 每次由调用方传入，绝不落日志。
 */
public final class VolcOpenApiSigner {

    private static final String ALGORITHM = "HMAC-SHA256";
    private static final String HMAC = "HmacSHA256";
    private static final DateTimeFormatter X_DATE =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter SHORT_DATE =
            DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    private VolcOpenApiSigner() {
    }

    /** 签名结果：直接塞进 HTTP 请求头即可。 */
    public record SignedHeaders(Map<String, String> headers) {
    }

    /**
     * 为一次 POST JSON 请求生成完整签名头。
     *
     * @param uri       完整请求 URI（含 {@code ?Action=&Version=} 查询串）
     * @param body      请求体原文（UTF-8）
     * @param accessKey AccessKeyId
     * @param secretKey AccessKeySecret
     * @param region    固定 {@code cn-beijing}
     * @param service   固定 {@code imagination}（音乐生成所属服务）
     * @param now       签名时刻（测试可注入固定值）
     */
    public static SignedHeaders signPostJson(URI uri, String body,
                                             String accessKey, String secretKey,
                                             String region, String service, Instant now) {
        String xDate = X_DATE.format(now);
        String shortDate = SHORT_DATE.format(now);
        String payloadHash = hex(sha256(body == null ? "" : body));
        String host = uri.getHost();

        // 参与签名的 header：按小写名字典序，且必须与 SignedHeaders 声明一致。
        Map<String, String> signed = new TreeMap<>();
        signed.put("content-type", "application/json");
        signed.put("host", host);
        signed.put("x-content-sha256", payloadHash);
        signed.put("x-date", xDate);

        StringBuilder canonicalHeaders = new StringBuilder();
        signed.forEach((k, v) -> canonicalHeaders.append(k).append(':').append(v.trim()).append('\n'));
        String signedHeaderNames = String.join(";", signed.keySet());

        String canonicalRequest = "POST" + '\n'
                + canonicalPath(uri) + '\n'
                + canonicalQuery(uri) + '\n'
                + canonicalHeaders + '\n'
                + signedHeaderNames + '\n'
                + payloadHash;

        String credentialScope = shortDate + "/" + region + "/" + service + "/request";
        String stringToSign = ALGORITHM + '\n'
                + xDate + '\n'
                + credentialScope + '\n'
                + hex(sha256(canonicalRequest));

        byte[] kDate = hmac(secretKey.getBytes(StandardCharsets.UTF_8), shortDate);
        byte[] kRegion = hmac(kDate, region);
        byte[] kService = hmac(kRegion, service);
        byte[] kSigning = hmac(kService, "request");
        String signature = hex(hmac(kSigning, stringToSign));

        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Host", host);
        headers.put("Content-Type", "application/json");
        headers.put("X-Date", xDate);
        headers.put("X-Content-Sha256", payloadHash);
        headers.put("Authorization", ALGORITHM
                + " Credential=" + accessKey + "/" + credentialScope
                + ", SignedHeaders=" + signedHeaderNames
                + ", Signature=" + signature);
        return new SignedHeaders(headers);
    }

    /** 规范化路径：空路径按 "/" 处理（火山 OpenAPI 的 Action 走 query 而非 path）。 */
    private static String canonicalPath(URI uri) {
        String p = uri.getRawPath();
        return (p == null || p.isEmpty()) ? "/" : p;
    }

    /**
     * 规范化查询串：按 key 字典序排序、逐段 URI 编码后用 & 连接。
     * 未编码或未排序都会导致签名不匹配（火山返回 SignatureDoesNotMatch）。
     */
    private static String canonicalQuery(URI uri) {
        String raw = uri.getRawQuery();
        if (raw == null || raw.isEmpty()) return "";
        TreeMap<String, String> params = new TreeMap<>();
        for (String pair : raw.split("&")) {
            if (pair.isEmpty()) continue;
            int i = pair.indexOf('=');
            String k = i < 0 ? pair : pair.substring(0, i);
            String v = i < 0 ? "" : pair.substring(i + 1);
            params.put(uriEncode(urlDecode(k)), uriEncode(urlDecode(v)));
        }
        StringBuilder sb = new StringBuilder();
        params.forEach((k, v) -> {
            if (sb.length() > 0) sb.append('&');
            sb.append(k).append('=').append(v);
        });
        return sb.toString();
    }

    private static String urlDecode(String s) {
        return java.net.URLDecoder.decode(s, StandardCharsets.UTF_8);
    }

    /**
     * RFC 3986 编码。注意与 {@code URLEncoder} 的差异：空格必须是 %20 而不是 +，
     * 且 {@code - _ . ~} 不转义。
     */
    private static String uriEncode(String s) {
        StringBuilder out = new StringBuilder();
        for (byte b : s.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xFF;
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
                    || c == '-' || c == '_' || c == '.' || c == '~') {
                out.append((char) c);
            } else {
                out.append('%').append(String.format("%02X", c));
            }
        }
        return out.toString();
    }

    private static byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(key, HMAC));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 failed", e);
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
