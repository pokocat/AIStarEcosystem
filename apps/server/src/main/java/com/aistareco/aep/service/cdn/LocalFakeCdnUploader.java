package com.aistareco.aep.service.cdn;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;

/**
 * 本地 fake-CDN：把文件复制到 aep.cdn.local-root 下，对外用 aep.cdn.public-base-url 拼出可访问 URL。
 *
 * dev / 单机部署默认使用。生产环境切到 OSS / S3 后该 bean 不再注入。
 *
 * 路径安全：upload 拒绝穿越（key 不可解出 root 之外）。
 */
@Component
@ConditionalOnProperty(name = "aep.cdn.driver", havingValue = "local", matchIfMissing = true)
public class LocalFakeCdnUploader implements CdnUploader {

    private static final Logger log = LoggerFactory.getLogger(LocalFakeCdnUploader.class);

    private final Path root;
    private final String publicBase;

    public LocalFakeCdnUploader(
            @Value("${aep.cdn.local-root:./cdn-mock}") String root,
            @Value("${aep.cdn.public-base-url:/cdn}") String publicBase
    ) {
        this.root = Paths.get(root).toAbsolutePath().normalize();
        this.publicBase = trimTrailingSlash(publicBase);
        log.info("[cdn] LocalFakeCdnUploader root={} publicBase={}", this.root, this.publicBase);
    }

    @Override
    public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
        if (key == null || key.isBlank()) throw new IllegalArgumentException("key required");
        Path dst = root.resolve(key).normalize();
        if (!dst.startsWith(root)) {
            throw new SecurityException("path traversal: " + key);
        }
        Files.createDirectories(dst.getParent());
        Files.copy(localFile, dst, StandardCopyOption.REPLACE_EXISTING);
        long size = Files.size(dst);
        String cdnUrl = publicUrlFor(key);
        log.info("[cdn] uploaded local→fake key={} bytes={} url={}", key, size, cdnUrl);
        return new CdnUploadResult(cdnUrl, key, size, Instant.now());
    }

    @Override
    public void delete(String key) throws IOException {
        if (key == null || key.isBlank()) return;
        Path dst = root.resolve(key).normalize();
        if (!dst.startsWith(root)) return; // refuse traversal silently
        Files.deleteIfExists(dst);
        log.info("[cdn] deleted local key={}", key);
    }

    @Override
    public String publicUrlFor(String key) {
        String cleanKey = key.startsWith("/") ? key.substring(1) : key;
        return publicBase + "/" + cleanKey;
    }

    @Override
    public String driverName() {
        return "local";
    }

    /** dev 内 server 自身需要也能读到这些文件做静态服务（见 CdnWebConfig）。 */
    public Path getRoot() {
        return root;
    }

    /** 公开 base URL（如 "/cdn" 或 "http://cdn.example.com"）。 */
    public String getPublicBase() {
        return publicBase;
    }

    private static String trimTrailingSlash(String s) {
        if (s == null || s.isBlank()) return "/cdn";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
