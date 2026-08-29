package com.aistareco.aep.service.music;

import com.aistareco.aep.config.MusicGenProperties;
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

/**
 * 把音乐模型返回的时效音频立即转存到我方持久存储。
 *
 * <p>火山文档明确要求：返回的 AudioUrl「仅供参考您转存使用、请勿直接用在应用中」，
 * 且视频云链路可能把 wav 转成别的容器。所以产物必须先镜像，DB 只落我方 cdnKey
 * （§4.7.4），绝不把上游地址当作品真值。
 *
 * <p>安全：强制 https + 解析所有 A 记录拒绝内网地址（防 SSRF），流式写入并硬限大小。
 */
@Service
public class MusicOutputStorage {

    private final FileStorageService storage;
    private final MusicGenProperties props;
    private final HttpClient http;

    public MusicOutputStorage(FileStorageService storage, MusicGenProperties props) {
        this.storage = storage;
        this.props = props;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    /** 转存结果：我方 object key + 落地字节数。 */
    public record Stored(String cdnKey, long bytes) {
    }

    public Stored persistAudio(String ownerId, String remoteUrl) {
        String ext = props.getVolcAudioFormat();
        if (ext == null || ext.isBlank()) ext = "mp3";
        String contentType = "wav".equalsIgnoreCase(ext) ? "audio/wav" : "audio/mpeg";
        return persist(ownerId, remoteUrl, "music/tracks", ext, contentType,
                props.getMaxDownloadBytes(), "生成的音频");
    }

    public void deleteQuietly(String cdnKey) {
        if (cdnKey == null || cdnKey.isBlank()) return;
        try {
            storage.delete(cdnKey);
        } catch (RuntimeException ignored) {
            // best-effort：删不掉最多留个孤儿文件，不该阻断主流程
        }
    }

    private Stored persist(String ownerId, String remoteUrl, String category, String ext,
                           String contentType, long maxBytes, String label) {
        URI uri = safePublicHttps(remoteUrl);
        Path temp = null;
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofMinutes(5)).GET().build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw failure(label + "下载失败（HTTP " + response.statusCode() + "）");
            }
            long declared = response.headers().firstValueAsLong("content-length").orElse(-1);
            if (declared > maxBytes) throw failure(label + "超过大小限制");
            temp = Files.createTempFile("music-output-", "." + ext);
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
            String key = storage.storeExisting(temp, category, ownerId, ext, contentType, true).key();
            return new Stored(key, total);
        } catch (BusinessException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw failure("音频转存被中断，请稍后重试");
        } catch (Exception e) {
            throw failure("音频转存失败，请稍后重试");
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (Exception ignored) {
                    // 已被 storeExisting 移走时会走到这里，忽略
                }
            }
        }
    }

    private static URI safePublicHttps(String raw) {
        try {
            URI uri = URI.create(raw == null ? "" : raw);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw failure("音频地址无效");
            }
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress() || address.isMulticastAddress()) {
                    throw failure("音频地址不可访问");
                }
            }
            return uri;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw failure("音频地址无效");
        }
    }

    private static BusinessException failure(String message) {
        return new BusinessException(HttpStatus.BAD_GATEWAY, "MUSIC_OUTPUT_PERSIST_FAILED", message);
    }
}
