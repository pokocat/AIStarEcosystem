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

/** 将石榴时效音视频立即转存到我方持久存储；不把上游临时 URL 当成作品真值。 */
@Service
public class ClipOutputStorage {
    private static final long MAX_VIDEO_BYTES = 512L * 1024 * 1024;
    private static final long MAX_AUDIO_BYTES = 20L * 1024 * 1024;
    private final FileStorageService storage;
    private final HttpClient http;

    public ClipOutputStorage(FileStorageService storage) {
        this.storage = storage;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public String persist(String ownerId, String remoteUrl) {
        return persist(ownerId, remoteUrl, "clip/segments", "mp4", "video/mp4", MAX_VIDEO_BYTES, "上游成片");
    }

    /** b-roll 的 TTS 音频也必须先镜像到我方存储，避免把石榴时效 URL 写进任务状态。 */
    public String persistAudio(String ownerId, String remoteUrl) {
        return persist(ownerId, remoteUrl, "clip/segment-audio", "mp3", "audio/mpeg", MAX_AUDIO_BYTES, "上游配音");
    }

    private String persist(String ownerId, String remoteUrl, String category, String ext, String contentType,
                           long maxBytes, String label) {
        URI uri = safePublicHttps(remoteUrl);
        Path temp = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofMinutes(5)).GET().build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw failure(label + "下载失败（HTTP " + response.statusCode() + ")");
            }
            long declared = response.headers().firstValueAsLong("content-length").orElse(-1);
            if (declared > maxBytes) throw failure(label + "超过大小限制");
            temp = Files.createTempFile("clip-output-", "." + ext);
            long total = 0;
            try (InputStream in = response.body(); var out = Files.newOutputStream(temp)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) >= 0) {
                    total += read;
                    if (total > maxBytes) throw failure(label + "超过大小限制");
                    out.write(buffer, 0, read);
                }
            }
            if (total == 0) throw failure(label + "为空");
            return storage.storeExisting(temp, category, ownerId, ext, contentType, true).key();
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw failure("上游文件转存被中断，请稍后重试");
        } catch (Exception e) {
            throw failure("上游文件转存失败，请稍后重试");
        } finally {
            if (temp != null) try { Files.deleteIfExists(temp); } catch (Exception ignored) {}
        }
    }

    private static URI safePublicHttps(String raw) {
        try {
            URI uri = URI.create(raw == null ? "" : raw);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) throw failure("上游文件地址无效");
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                    throw failure("上游文件地址不可访问");
                }
            }
            return uri;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw failure("上游文件地址无效");
        }
    }

    private static BusinessException failure(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_OUTPUT_PERSIST_FAILED", message);
    }
}
