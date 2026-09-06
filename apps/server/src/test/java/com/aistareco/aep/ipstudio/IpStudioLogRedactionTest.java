package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.service.DapMultimodalClient;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 请求日志里的图片输入摘要**绝不能带签名**（AGENTS.md v0.150 红线：签名 URL 既不落库也不进日志）。
 *
 * <p>IP 工作台是第一条把 OSS 签名 URL 当参考图直接喂给上游模型的链路，
 * {@code summarizeImageInput} 原来 {@code truncate(input, 200)} 会把
 * {@code ?Expires=…&Signature=…} 整段打进 INFO 日志 —— 谁看到日志谁就能下载用户的原始照片。
 * 用例挂在 ipstudio 包下（文件所有权约束），守的是 dap 侧那一个方法。
 */
class IpStudioLogRedactionTest {

    @Test
    void signedUrlQueryIsStrippedFromLogs() {
        String signed = "https://cdn.aibuzz.cn/ipstudio_source/u_42/9f8e.png"
                + "?Expires=1789000000&OSSAccessKeyId=LTAI5tSecret&Signature=abc%2Fdef%2Bghi%3D";
        String out = DapMultimodalClient.summarizeImageInput(signed);
        assertEquals("https://cdn.aibuzz.cn/ipstudio_source/u_42/9f8e.png?<redacted>", out);
        assertFalse(out.contains("Signature"), out);
        assertFalse(out.contains("OSSAccessKeyId"), out);
        assertFalse(out.contains("Expires"), out);
    }

    @Test
    void aliyunCdnAuthKeyIsStrippedToo() {
        String out = DapMultimodalClient.summarizeImageInput(
                "https://cdn.aibuzz.cn/a/b.png?auth_key=1789-0-0-9d1f6c0aa1");
        assertFalse(out.contains("auth_key"), out);
        assertTrue(out.endsWith("?<redacted>"), out);
    }

    @Test
    void unsignedUrlKeepsItsPathAndSaysNothingAboutRedaction() {
        String out = DapMultimodalClient.summarizeImageInput("https://cdn.aibuzz.cn/a/b.png");
        assertEquals("https://cdn.aibuzz.cn/a/b.png", out);
    }

    @Test
    void fragmentIsStrippedAndDataUriStillOnlyShowsHeaderAndLength() {
        assertEquals("https://h/a.png", DapMultimodalClient.summarizeImageInput("https://h/a.png#tok=xyz"));
        String data = "data:image/png;base64," + "A".repeat(500);
        String out = DapMultimodalClient.summarizeImageInput(data);
        assertEquals("data:image/png;base64 len=" + data.length(), out);
        assertFalse(out.contains("AAAA"), out);
        assertNull(DapMultimodalClient.summarizeImageInput(null));
    }
}
