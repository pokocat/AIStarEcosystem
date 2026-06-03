package com.aistareco.aep.service.cdn;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.Locale;

/**
 * 阿里云 OSS 实现。
 *
 * 启用：aep.cdn.driver=oss + aep.cdn.oss.{endpoint,bucket,access-key-id,access-key-secret,base-url}
 * base-url 应配置为可公网访问的视频 CDN/OSS 域名，例如 https://cdn.example.com。
 */
@Component
@ConditionalOnProperty(name = "aep.cdn.driver", havingValue = "oss")
public class AliyunOssCdnUploader implements CdnUploader {

    private static final Logger log = LoggerFactory.getLogger(AliyunOssCdnUploader.class);

    private final String endpoint;
    private final String bucket;
    private final String baseUrl;
    private final String keyPrefix;
    private final OSS ossClient;

    // v0.47+：URL 签名配置
    private final SignStrategy signStrategy;
    private final long defaultTtlSeconds;
    private final String cdnAuthKey;
    private final SecureRandom rng = new SecureRandom();

    public AliyunOssCdnUploader(
            @Value("${aep.cdn.oss.endpoint:}") String endpoint,
            @Value("${aep.cdn.oss.bucket:}") String bucket,
            @Value("${aep.cdn.oss.access-key-id:}") String accessKeyId,
            @Value("${aep.cdn.oss.access-key-secret:}") String accessKeySecret,
            @Value("${aep.cdn.oss.base-url:}") String baseUrl,
            @Value("${aep.cdn.oss.key-prefix:}") String keyPrefix,
            @Value("${aep.cdn.signed-url.strategy:none}") String signStrategyRaw,
            @Value("${aep.cdn.signed-url.ttl-seconds:3600}") long ttlSeconds,
            @Value("${aep.cdn.signed-url.cdn-auth-key:}") String cdnAuthKey
    ) {
        this.endpoint = requireText(endpoint, "aep.cdn.oss.endpoint");
        this.bucket = requireText(bucket, "aep.cdn.oss.bucket");
        this.baseUrl = trimTrailingSlash(requireText(baseUrl, "aep.cdn.oss.base-url"));
        this.keyPrefix = normalizePrefix(keyPrefix);
        String id = requireText(accessKeyId, "aep.cdn.oss.access-key-id");
        String secret = requireText(accessKeySecret, "aep.cdn.oss.access-key-secret");
        this.ossClient = new OSSClientBuilder().build(this.endpoint, id, secret);

        this.signStrategy = parseStrategy(signStrategyRaw);
        this.defaultTtlSeconds = ttlSeconds > 0 ? ttlSeconds : 3600L;
        this.cdnAuthKey = cdnAuthKey == null ? "" : cdnAuthKey.trim();
        if (this.signStrategy == SignStrategy.CDN && this.cdnAuthKey.isBlank()) {
            throw new IllegalStateException(
                    "aep.cdn.signed-url.strategy=cdn 但未配置 aep.cdn.signed-url.cdn-auth-key "
                            + "(请在阿里云 CDN 控制台「访问控制 → URL 鉴权 Type A」获取 PrivateKey)");
        }

        log.info("[cdn] AliyunOssCdnUploader bucket={} endpoint={} publicBase={} keyPrefix={} signStrategy={} ttl={}s",
                this.bucket, this.endpoint, this.baseUrl,
                this.keyPrefix.isBlank() ? "<none>" : this.keyPrefix,
                this.signStrategy, this.defaultTtlSeconds);
        if (this.signStrategy == SignStrategy.NONE) {
            log.warn("[cdn] aep.cdn.signed-url.strategy=none —— 生产环境强烈建议改为 oss 或 cdn 防 OSS 流量盗刷");
        }
    }

    @Override
    public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
        if (localFile == null) throw new IllegalArgumentException("localFile required");
        if (!Files.isRegularFile(localFile)) {
            throw new IOException("OSS upload source is not a file: " + localFile);
        }

        String objectKey = objectKeyFor(key);
        long size = Files.size(localFile);

        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(size);
        if (contentType != null && !contentType.isBlank()) {
            metadata.setContentType(contentType);
        }

        PutObjectRequest request = new PutObjectRequest(bucket, objectKey, localFile.toFile());
        request.setMetadata(metadata);
        try {
            ossClient.putObject(request);
        } catch (OSSException | ClientException e) {
            throw new IOException("OSS upload failed key=" + objectKey + ": " + e.getMessage(), e);
        }

        String cdnUrl = publicUrlFor(objectKey);
        log.info("[cdn] uploaded oss key={} bytes={} contentType={} url={}",
                objectKey, size, contentType, cdnUrl);
        return new CdnUploadResult(cdnUrl, objectKey, size, Instant.now());
    }

    @Override
    public void delete(String key) throws IOException {
        if (key == null || key.isBlank()) return;
        String objectKey = objectKeyFor(key);
        try {
            ossClient.deleteObject(bucket, objectKey);
        } catch (OSSException | ClientException e) {
            throw new IOException("OSS delete failed key=" + objectKey + ": " + e.getMessage(), e);
        }
        log.info("[cdn] deleted oss key={}", objectKey);
    }

    @Override
    public String publicUrlFor(String key) {
        return baseUrl + "/" + objectKeyFor(key);
    }

    @Override
    public String signedUrlFor(String key, long ttlSeconds) {
        long ttl = ttlSeconds > 0 ? ttlSeconds : defaultTtlSeconds;
        String objectKey = objectKeyFor(key);
        return switch (signStrategy) {
            case NONE -> publicUrlFor(key);
            case OSS  -> ossPresignedUrl(objectKey, ttl);
            case CDN  -> cdnTypeAUrl(objectKey, ttl);
        };
    }

    @Override
    public String driverName() {
        return "oss";
    }

    /**
     * OSS pre-signed URL（{@link OSS#generatePresignedUrl}）。
     * URL 形如 {@code https://<bucket>.<endpoint>/<key>?Expires=...&OSSAccessKeyId=...&Signature=...}。
     *
     * <p><b>注意</b>：返回的 host 是 OSS endpoint（不是 CDN 域名）；想走 CDN 节省带宽请用 CDN 策略。
     * 这里把 OSS endpoint 自动从 internal 改成 public —— internal endpoint 只能从 ECS VPC 内访问。
     */
    private String ossPresignedUrl(String objectKey, long ttl) {
        try {
            Date expiration = new Date(System.currentTimeMillis() + ttl * 1000L);
            GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucket, objectKey, HttpMethod.GET);
            req.setExpiration(expiration);
            String signed = ossClient.generatePresignedUrl(req).toString();
            // SDK 用构造器传入的 endpoint（可能是 -internal）做 host —— 修正为公网 endpoint
            return rewritePublicEndpoint(signed);
        } catch (Exception e) {
            log.warn("[cdn] ossPresignedUrl failed key={}: {} → 回退 public URL", objectKey, e.getMessage());
            return baseUrl + "/" + objectKey;
        }
    }

    /**
     * 阿里云 CDN URL 鉴权 Type A：
     * {@code https://cdn.example.com/path?auth_key=<expires>-<rand>-<uid>-<md5sum>}
     *
     * <p>SignString = {@code URI + "-" + expires + "-" + rand + "-" + uid + "-" + PrivateKey}
     * <p>auth_key   = {@code expires + "-" + rand + "-" + uid + "-" + md5(SignString)}
     *
     * <p>URI 是 path 部分（含开头 /，不含 query），expires 是 Unix epoch seconds。
     * PrivateKey 来自阿里云 CDN 控制台「访问控制 → URL 鉴权 → Type A」配置。
     * 见 https://help.aliyun.com/document_detail/85117.html
     */
    private String cdnTypeAUrl(String objectKey, long ttl) {
        long expires = System.currentTimeMillis() / 1000L + ttl;
        String rand = randomHex(16);
        String uid = "0";  // Aliyun 文档：uid 设 0 即可，由 CDN 忽略
        String uri;
        try {
            uri = new URI(baseUrl + "/" + objectKey).getRawPath();
            if (uri == null || uri.isBlank()) uri = "/" + objectKey;
        } catch (Exception e) {
            uri = "/" + objectKey;
        }
        String signString = uri + "-" + expires + "-" + rand + "-" + uid + "-" + cdnAuthKey;
        String md5 = md5Hex(signString);
        String authKey = expires + "-" + rand + "-" + uid + "-" + md5;
        return baseUrl + "/" + objectKey + "?auth_key=" + authKey;
    }

    /** OSS endpoint 含 "-internal" 时改为公网 endpoint —— pre-signed URL 必须公网可访问。 */
    private String rewritePublicEndpoint(String url) {
        if (url == null) return null;
        return url.replace("-internal.aliyuncs.com", ".aliyuncs.com");
    }

    private String randomHex(int bytes) {
        byte[] buf = new byte[bytes];
        rng.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }

    private static String md5Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).toLowerCase(Locale.ROOT);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available", e);
        }
    }

    private static SignStrategy parseStrategy(String raw) {
        if (raw == null || raw.isBlank()) return SignStrategy.NONE;
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "none" -> SignStrategy.NONE;
            case "oss"  -> SignStrategy.OSS;
            case "cdn"  -> SignStrategy.CDN;
            default -> throw new IllegalStateException(
                    "aep.cdn.signed-url.strategy 仅支持 none|oss|cdn，实际：" + raw);
        };
    }

    enum SignStrategy { NONE, OSS, CDN }

    @PreDestroy
    public void shutdown() {
        ossClient.shutdown();
    }

    private String objectKeyFor(String key) {
        String clean = normalizeKey(key);
        if (keyPrefix.isBlank()) return clean;
        if (clean.equals(keyPrefix) || clean.startsWith(keyPrefix + "/")) return clean;
        return keyPrefix + "/" + clean;
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) throw new IllegalArgumentException("key required");
        String clean = key.startsWith("/") ? key.substring(1) : key;
        if (clean.isBlank() || clean.contains("..") || clean.contains("\\") || clean.startsWith("/")) {
            throw new IllegalArgumentException("invalid OSS object key: " + key);
        }
        return clean;
    }

    private static String normalizePrefix(String value) {
        if (value == null || value.isBlank()) return "";
        String clean = value.trim();
        while (clean.startsWith("/")) clean = clean.substring(1);
        while (clean.endsWith("/")) clean = clean.substring(0, clean.length() - 1);
        if (clean.isBlank()) return "";
        if (clean.contains("..") || clean.contains("\\")) {
            throw new IllegalStateException("invalid aep.cdn.oss.key-prefix: " + value);
        }
        return clean;
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("aep.cdn.driver=oss 但未配置 " + name);
        }
        return value.trim();
    }

    private static String trimTrailingSlash(String value) {
        String clean = value.trim();
        while (clean.endsWith("/")) {
            clean = clean.substring(0, clean.length() - 1);
        }
        return clean;
    }
}
