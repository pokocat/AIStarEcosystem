package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 例行 QA 安全回归（2026-07-24）：{@link AssetDownloader#ensureLocal} 此前对 http(s) 绝对
 * URL 零校验就直接发起服务端 GET——而其唯一调用方
 * {@code MixcutRenderingService.resolveOne} 读取的 {@code file_url} 来自
 * {@code POST /api/mixcut/jobs}（仅要求 authenticated()，任意登录用户可调）请求体
 * {@code slot_bindings} 里客户端自行提交的字段，未必经 {@code asset_id} 回查 DB 校验——
 * 可被用来让服务端对内网 / 云 metadata 地址发起请求，构成 SSRF。
 *
 * 断言范围：只测试新增的 {@code isBlockedHost} 判定逻辑本身（纯函数、无网络 I/O，字面量 IP
 * 由 JDK 本地解析不触发真实 DNS 查询）+ {@code ensureLocal} 对已知恶意地址在发起任何网络连接
 * 之前就抛出 IOException。不测试"合法公网 CDN 域名可正常下载"这一分支——那需要真实网络访问，
 * 不适合在沙箱单测环境断言；该分支的正确性由生产环境 mixcut 渲染的既有回归验证覆盖。
 */
class AssetDownloaderTest {

    private static boolean isBlockedHost(String host) throws Exception {
        Method m = AssetDownloader.class.getDeclaredMethod("isBlockedHost", String.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, host);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "100.100.100.200",   // 阿里云 metadata（CGNAT 100.64.0.0/10，非 RFC1918，需显式拦）
            "169.254.169.254",   // AWS/通用云 metadata（link-local）
            "127.0.0.1",         // 环回
            "localhost",         // 环回（域名形式）
            "10.0.0.1",          // RFC1918 私网 A 段
            "172.16.0.1",        // RFC1918 私网 B 段
            "192.168.1.1",       // RFC1918 私网 C 段
            "0.0.0.0",           // any-local
            "224.0.0.1",         // 组播
    })
    void isBlockedHost_rejectsInternalAndMetadataAddresses(String host) throws Exception {
        assertTrue(isBlockedHost(host), "应当拦截内部/metadata 地址: " + host);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "8.8.8.8",     // 公网 IP（Google DNS，字面量，仅本地解析不发起真实网络请求）
            "1.1.1.1",     // 公网 IP（Cloudflare DNS）
    })
    void isBlockedHost_allowsPublicAddresses(String host) throws Exception {
        assertFalse(isBlockedHost(host), "不应拦截公网地址: " + host);
    }

    @Test
    void isBlockedHost_rejectsNullOrBlankHost() throws Exception {
        assertTrue(isBlockedHost(null));
        assertTrue(isBlockedHost(""));
        assertTrue(isBlockedHost("   "));
    }

    @Test
    void ensureLocal_rejectsCloudMetadataUrl_beforeAnyNetworkCall() {
        AssetDownloader downloader = new AssetDownloader(new MixcutProperties());
        IOException ex = assertThrows(IOException.class,
                () -> downloader.ensureLocal("http://100.100.100.200/latest/meta-data/ram/security-credentials/role"));
        assertTrue(ex.getMessage().contains("disallowed"), "异常信息应说明地址被拒绝: " + ex.getMessage());
    }

    @Test
    void ensureLocal_rejectsInternalServiceUrl_beforeAnyNetworkCall() {
        AssetDownloader downloader = new AssetDownloader(new MixcutProperties());
        IOException ex = assertThrows(IOException.class,
                () -> downloader.ensureLocal("http://169.254.169.254/latest/meta-data/"));
        assertTrue(ex.getMessage().contains("disallowed"), "异常信息应说明地址被拒绝: " + ex.getMessage());
    }
}
