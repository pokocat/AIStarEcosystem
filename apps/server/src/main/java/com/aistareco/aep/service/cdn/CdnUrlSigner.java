package com.aistareco.aep.service.cdn;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * v0.47+：URL 签名工具 —— DTO 序列化前一站。
 *
 * <p>背景：{@code MixcutRenderOutput.cdnUrl} 等字段长期落 DB 后随响应直接返回前端。
 * URL 永不过期 + 公开访问 → 一旦泄漏（页面被爬 / URL 进缓存 / CDN 域名被扫）
 * 就被吸 OSS 流量费。
 *
 * <p>本服务统一对外提供 {@link #maybeSign(String)} —— 调用方传入任意 URL，
 * 自动识别是否属于本仓 CDN 域，是则用 {@link CdnUploader#signedUrlFor} 加时效签名，
 * 否则原样返回（local path / 第三方外链 / null 不处理）。
 *
 * <p>策略由 {@code aep.cdn.signed-url.strategy} 决定（none|oss|cdn）；
 * 默认 TTL 由 {@code aep.cdn.signed-url.ttl-seconds} 决定（默认 3600s）。
 *
 * <p>使用方式：业务 service 持有 CdnUrlSigner，DTO {@code from(entity, signer)}
 * 工厂里对每个 URL 字段调一次 {@code signer.maybeSign(field)}。
 */
@Service
public class CdnUrlSigner {

    private static final Logger log = LoggerFactory.getLogger(CdnUrlSigner.class);

    /** 空操作单例 —— 老测试 / seeder 不便注入 Spring bean 时用。 */
    public static final CdnUrlSigner NOOP = new CdnUrlSigner((CdnUploader) null, "", 0L);

    private final CdnUploader uploader;
    private final String[] signedHostsPrefixes;  // 以这些 base URL 开头的 URL 才会被签名
    private final long defaultTtlSeconds;

    public CdnUrlSigner(
            ObjectProvider<CdnUploader> uploaderProvider,
            @Value("${aep.cdn.oss.base-url:}") String ossBaseUrl,
            @Value("${aep.cdn.signed-url.ttl-seconds:3600}") long defaultTtlSeconds
    ) {
        this.uploader = uploaderProvider == null ? null : uploaderProvider.getIfAvailable();
        this.defaultTtlSeconds = defaultTtlSeconds > 0 ? defaultTtlSeconds : 3600L;
        this.signedHostsPrefixes = buildPrefixes(ossBaseUrl);
        if (this.uploader != null) {
            log.info("[cdn-signer] driver={} signedPrefixes={} defaultTtl={}s",
                    this.uploader.driverName(), String.join(",", signedHostsPrefixes), this.defaultTtlSeconds);
        }
    }

    /** 内部静态构造（用于 NOOP）。 */
    private CdnUrlSigner(CdnUploader uploader, String ossBaseUrl, long defaultTtlSeconds) {
        this.uploader = uploader;
        this.defaultTtlSeconds = defaultTtlSeconds;
        this.signedHostsPrefixes = buildPrefixes(ossBaseUrl);
    }

    /**
     * 自动判断签名：URL 是 OSS/CDN 域 → 签；否则原样。null/blank → null/原样。
     * 用默认 TTL（{@code aep.cdn.signed-url.ttl-seconds}）。
     */
    public String maybeSign(String url) {
        return maybeSign(url, defaultTtlSeconds);
    }

    /**
     * 同 {@link #maybeSign(String)}，但允许显式指定 TTL 秒数。
     * 适合高敏感资源用更短 TTL（如缩略图 600s）/ 大视频用更长 TTL（如 4h）。
     */
    public String maybeSign(String url, long ttlSeconds) {
        if (url == null || url.isBlank()) return url;
        if (uploader == null) return url;
        if (!isSignable(url)) return url;
        String key = extractKey(url);
        if (key == null || key.isBlank()) return url;
        try {
            return uploader.signedUrlFor(key, ttlSeconds);
        } catch (Exception e) {
            log.warn("[cdn-signer] sign failed url={} → 原样返回: {}", url, e.getMessage());
            return url;
        }
    }

    private boolean isSignable(String url) {
        for (String prefix : signedHostsPrefixes) {
            if (!prefix.isBlank() && url.startsWith(prefix)) return true;
        }
        return false;
    }

    /** 从完整 URL 抽出 key —— base 之后的部分（去开头 /，砍 query/fragment）。 */
    private String extractKey(String url) {
        for (String prefix : signedHostsPrefixes) {
            if (!prefix.isBlank() && url.startsWith(prefix)) {
                String rest = url.substring(prefix.length());
                while (rest.startsWith("/")) rest = rest.substring(1);
                int q = rest.indexOf('?');
                if (q >= 0) rest = rest.substring(0, q);
                int h = rest.indexOf('#');
                if (h >= 0) rest = rest.substring(0, h);
                return rest;
            }
        }
        return null;
    }

    /** base URL 归一化 → 多写一份 http/https 互换前缀，防配置只填一种 scheme 后请求换 scheme 跳过签名。 */
    private static String[] buildPrefixes(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) return new String[]{""};
        String trimmed = baseUrl.trim();
        while (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("https://")) {
            return new String[]{trimmed, "http://" + trimmed.substring("https://".length())};
        }
        if (trimmed.toLowerCase(Locale.ROOT).startsWith("http://")) {
            return new String[]{trimmed, "https://" + trimmed.substring("http://".length())};
        }
        return new String[]{trimmed};
    }
}
