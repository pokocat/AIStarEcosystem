package com.aistareco.aep.service.music;

import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 火山 OpenAPI V4 签名。
 *
 * <p>签名对了才有得谈 —— 签错上游一律 SignatureDoesNotMatch，而且错误信息不会告诉你哪一步错了。
 * 这里锁住几条最容易写错的规则：查询串排序、RFC3986 编码、签名头集合、以及派生密钥链的确定性。
 */
class VolcOpenApiSignerTest {

    private static final Instant FIXED = Instant.parse("2025-12-01T10:38:33Z");
    private static final String AK = "AKLTtest";
    private static final String SK = "c2VjcmV0LWtleQ==";

    private Map<String, String> sign(String url, String body) {
        return VolcOpenApiSigner.signPostJson(URI.create(url), body, AK, SK,
                "cn-beijing", "imagination", FIXED).headers();
    }

    @Test
    void producesRequiredHeaders() {
        var h = sign("https://open.volcengineapi.com/?Action=GenSongForTime&Version=2024-08-12", "{}");

        assertEquals("open.volcengineapi.com", h.get("Host"));
        assertEquals("application/json", h.get("Content-Type"));
        assertEquals("20251201T103833Z", h.get("X-Date"), "X-Date 必须是 UTC 且精确到秒");
        assertNotNull(h.get("X-Content-Sha256"));
        assertTrue(h.get("Authorization").startsWith("HMAC-SHA256 Credential=" + AK + "/20251201/cn-beijing/imagination/request"),
                "凭据范围必须是 AK/短日期/区域/服务/request");
        assertTrue(h.get("Authorization").contains("SignedHeaders=content-type;host;x-content-sha256;x-date"),
                "参与签名的 header 必须按小写字典序");
        assertTrue(h.get("Authorization").contains("Signature="));
    }

    @Test
    void payloadHashCoversBody() {
        String emptyHash = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "")
                .get("X-Content-Sha256");
        String bodyHash = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "{\"TaskID\":\"1\"}")
                .get("X-Content-Sha256");

        // 空 body 的 SHA-256 是个常量，写死它能顺带验证十六进制小写编码没写反
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", emptyHash);
        assertNotEquals(emptyHash, bodyHash, "body 变了签名摘要必须跟着变");
    }

    @Test
    void queryOrderDoesNotChangeSignature() {
        // 规范化要求按 key 排序，所以两种书写顺序必须得到同一个签名
        var a = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "{}");
        var b = sign("https://open.volcengineapi.com/?Version=2024-08-12&Action=QuerySong", "{}");
        assertEquals(a.get("Authorization"), b.get("Authorization"));
    }

    @Test
    void differentActionsProduceDifferentSignatures() {
        var song = sign("https://open.volcengineapi.com/?Action=GenSongForTime&Version=2024-08-12", "{}");
        var query = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "{}");
        assertNotEquals(song.get("Authorization"), query.get("Authorization"),
                "查询串参与签名，Action 不同签名必须不同");
    }

    @Test
    void signatureIsDeterministic() {
        var first = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "{\"TaskID\":\"x\"}");
        var second = sign("https://open.volcengineapi.com/?Action=QuerySong&Version=2024-08-12", "{\"TaskID\":\"x\"}");
        assertEquals(first.get("Authorization"), second.get("Authorization"),
                "同样的输入必须签出同样的结果，否则重试会随机失败");
    }
}
