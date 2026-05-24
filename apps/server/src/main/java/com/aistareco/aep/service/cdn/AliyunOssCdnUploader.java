package com.aistareco.aep.service.cdn;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

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

    public AliyunOssCdnUploader(
            @Value("${aep.cdn.oss.endpoint:}") String endpoint,
            @Value("${aep.cdn.oss.bucket:}") String bucket,
            @Value("${aep.cdn.oss.access-key-id:}") String accessKeyId,
            @Value("${aep.cdn.oss.access-key-secret:}") String accessKeySecret,
            @Value("${aep.cdn.oss.base-url:}") String baseUrl,
            @Value("${aep.cdn.oss.key-prefix:}") String keyPrefix
    ) {
        this.endpoint = requireText(endpoint, "aep.cdn.oss.endpoint");
        this.bucket = requireText(bucket, "aep.cdn.oss.bucket");
        this.baseUrl = trimTrailingSlash(requireText(baseUrl, "aep.cdn.oss.base-url"));
        this.keyPrefix = normalizePrefix(keyPrefix);
        String id = requireText(accessKeyId, "aep.cdn.oss.access-key-id");
        String secret = requireText(accessKeySecret, "aep.cdn.oss.access-key-secret");
        this.ossClient = new OSSClientBuilder().build(this.endpoint, id, secret);
        log.info("[cdn] AliyunOssCdnUploader bucket={} endpoint={} publicBase={} keyPrefix={}",
                this.bucket, this.endpoint, this.baseUrl, this.keyPrefix.isBlank() ? "<none>" : this.keyPrefix);
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
    public String driverName() {
        return "oss";
    }

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
