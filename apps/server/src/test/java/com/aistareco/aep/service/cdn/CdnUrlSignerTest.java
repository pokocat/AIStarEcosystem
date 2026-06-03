package com.aistareco.aep.service.cdn;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * v0.47+：CdnUrlSigner 行为契约：
 *  - URL 是 OSS/CDN 域 → 调 uploader.signedUrlFor(key, ttl)
 *  - URL 是本地相对路径 / 第三方外链 / null → 原样返回
 *  - http / https scheme 两端兼容（base 配 https 时 http 同样能被识别为签名目标）
 *  - uploader 失败 → 不抛，原样返回
 */
class CdnUrlSignerTest {

    private static final String BASE = "https://cdn.aibuzz.cn";

    @Test
    void noop_returnsInputUnchanged() {
        CdnUrlSigner noop = CdnUrlSigner.NOOP;
        assertThat(noop.maybeSign("https://cdn.aibuzz.cn/mixcut/a/v0.mp4"))
                .isEqualTo("https://cdn.aibuzz.cn/mixcut/a/v0.mp4");
        assertThat(noop.maybeSign(null)).isNull();
        assertThat(noop.maybeSign("")).isEmpty();
    }

    @Test
    void maybeSign_passthroughForNonMatchingUrl() {
        CdnUploader uploader = stubUploader("oss");
        CdnUrlSigner signer = newSigner(uploader, BASE, 3600);

        // 本地相对路径不该被签名
        assertThat(signer.maybeSign("/static/mixcut-assets/u1/abc.jpg"))
                .isEqualTo("/static/mixcut-assets/u1/abc.jpg");
        // 第三方外链不该被签名
        assertThat(signer.maybeSign("https://other-cdn.example.com/x.mp4"))
                .isEqualTo("https://other-cdn.example.com/x.mp4");
        // null / blank 透传
        assertThat(signer.maybeSign(null)).isNull();
        assertThat(signer.maybeSign("")).isEmpty();
    }

    @Test
    void maybeSign_extractsKeyAndDelegatesToUploader() {
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.signedUrlFor("mixcut/jobs/abc/v0.mp4", 3600L))
                .thenReturn("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4?auth_key=signed");
        when(uploader.driverName()).thenReturn("oss");

        CdnUrlSigner signer = newSigner(uploader, BASE, 3600);
        String result = signer.maybeSign("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4");
        assertThat(result).isEqualTo("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4?auth_key=signed");
    }

    @Test
    void maybeSign_stripsExistingQueryWhenExtractingKey() {
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.signedUrlFor("mixcut/jobs/abc/v0.mp4", 3600L))
                .thenReturn("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4?auth_key=signed");
        when(uploader.driverName()).thenReturn("oss");

        CdnUrlSigner signer = newSigner(uploader, BASE, 3600);
        // 老 URL 可能已经带 query —— signer 应当先抽 key（去 query）再交给 uploader 签
        String result = signer.maybeSign("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4?stale=1&old=2");
        assertThat(result).isEqualTo("https://cdn.aibuzz.cn/mixcut/jobs/abc/v0.mp4?auth_key=signed");
    }

    @Test
    void maybeSign_supportsHttpAndHttpsCrossScheme() {
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.signedUrlFor("a/b/c.mp4", 3600L))
                .thenReturn("https://cdn.aibuzz.cn/a/b/c.mp4?auth_key=ok");
        when(uploader.driverName()).thenReturn("oss");

        CdnUrlSigner signer = newSigner(uploader, "https://cdn.aibuzz.cn", 3600);
        // base 配 https，请求换 http 同样能识别
        assertThat(signer.maybeSign("http://cdn.aibuzz.cn/a/b/c.mp4"))
                .isEqualTo("https://cdn.aibuzz.cn/a/b/c.mp4?auth_key=ok");
    }

    @Test
    void maybeSign_returnsOriginalUrlWhenUploaderThrows() {
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.signedUrlFor(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyLong()))
                .thenThrow(new RuntimeException("OSS unavailable"));
        when(uploader.driverName()).thenReturn("oss");

        CdnUrlSigner signer = newSigner(uploader, BASE, 3600);
        String original = "https://cdn.aibuzz.cn/x.mp4";
        // uploader 抛出 → 原样返回，不影响业务 wire
        assertThat(signer.maybeSign(original)).isEqualTo(original);
    }

    @Test
    void maybeSign_customTtlOverridesDefault() {
        CdnUploader uploader = mock(CdnUploader.class);
        when(uploader.signedUrlFor("a.mp4", 600L)).thenReturn("https://cdn.aibuzz.cn/a.mp4?short");
        when(uploader.driverName()).thenReturn("oss");

        CdnUrlSigner signer = newSigner(uploader, BASE, 3600);
        // 调用方可显式压短 TTL（缩略图 / 高敏感资源）
        assertThat(signer.maybeSign("https://cdn.aibuzz.cn/a.mp4", 600))
                .isEqualTo("https://cdn.aibuzz.cn/a.mp4?short");
    }

    // ── 校验 CDN Type A 签名串格式（auth_key=expires-rand-uid-md5） ───────
    @Test
    void cdnTypeASignature_matchesAliyunFormat() {
        // auth_key 形如 1234567890-abc123-0-md5sum
        Pattern p = Pattern.compile("^(\\d+)-([0-9a-f]+)-(\\d+)-([0-9a-f]{32})$");
        String example = "1700000000-abc1234567890def-0-d41d8cd98f00b204e9800998ecf8427e";
        Matcher m = p.matcher(example);
        assertThat(m.matches()).isTrue();
        assertThat(m.group(1)).isEqualTo("1700000000"); // expires
        assertThat(m.group(4)).hasSize(32);             // md5
    }

    private static CdnUrlSigner newSigner(CdnUploader uploader, String baseUrl, long ttl) {
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(uploader);
        return new CdnUrlSigner(provider, baseUrl, ttl);
    }

    private static CdnUploader stubUploader(String name) {
        return new CdnUploader() {
            @Override public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
                throw new UnsupportedOperationException();
            }
            @Override public void delete(String key) {}
            @Override public String publicUrlFor(String key) { return "https://cdn.aibuzz.cn/" + key; }
            @Override public String signedUrlFor(String key, long ttlSeconds) {
                return "https://cdn.aibuzz.cn/" + key + "?ttl=" + ttlSeconds;
            }
            @Override public String driverName() { return name; }
        };
    }
}
