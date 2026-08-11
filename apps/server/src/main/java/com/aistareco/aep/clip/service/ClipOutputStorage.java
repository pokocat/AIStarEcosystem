package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

/** 将石榴时效成片立即转存到我方持久存储；不把上游临时 URL 当成作品真值。 */
@Service
public class ClipOutputStorage {
    private static final long MAX_BYTES = 512L * 1024 * 1024;
    private final FileStorageService storage;
    private final HttpClient http;

    public ClipOutputStorage(FileStorageService storage) {
        this.storage = storage;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public String persist(String ownerId, String remoteUrl) {
        URI uri = safePublicHttps(remoteUrl);
        Path temp = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofMinutes(5)).GET().build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw failure("上游成片下载失败（HTTP " + response.statusCode() + ")");
            }
            long declared = response.headers().firstValueAsLong("content-length").orElse(-1);
            if (declared > MAX_BYTES) throw failure("上游成片超过 512MB 限制");
            temp = Files.createTempFile("clip-output-", ".mp4");
            long total = 0;
            try (InputStream in = response.body(); var out = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    total += read;
                    if (total > MAX_BYTES) throw failure("上游成片超过 512MB 限制");
                    out.write(buffer, 0, read);
                }
            }
            if (total == 0) throw failure("上游成片为空");
            return storage.storeExisting(temp, "clip/works", ownerId, "mp4", "video/mp4", true).key();
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw failure("成片转存被中断，请稍后重试");
        } catch (Exception e) {
            throw failure("成片转存失败，请稍后重试");
        } finally {
            if (temp != null) try { Files.deleteIfExists(temp); } catch (Exception ignored) {}
        }
    }

    private static URI safePublicHttps(String raw) {
        try {
            URI uri = URI.create(raw == null ? "" : raw);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) throw failure("上游成片地址无效");
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                    throw failure("上游成片地址不可访问");
                }
            }
            return uri;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw failure("上游成片地址无效");
        }
    }

    private static BusinessException failure(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_OUTPUT_PERSIST_FAILED", message);
    }
}
