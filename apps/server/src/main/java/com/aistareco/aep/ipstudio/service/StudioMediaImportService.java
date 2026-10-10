package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

/** Free canvas imports. Content is validated before storage/quota writes; no model or credit calls. */
@Service
public class StudioMediaImportService {
    private static final long MIB = 1024L * 1024;
    private final FileStorageService storage;
    private final StorageQuotaService quota;
    private final FfmpegRunner ffmpeg;
    public record MediaImportResult(String key, String url, String mediaType, String mimeType,
                                    long bytes, String fileName, Integer width, Integer height, Double durationSec) {}
    public StudioMediaImportService(FileStorageService storage, StorageQuotaService quota, FfmpegRunner ffmpeg) {
        this.storage = storage; this.quota = quota; this.ffmpeg = ffmpeg;
    }
    public MediaImportResult upload(String user, MultipartFile file, String type) {
        if (!Set.of("image", "video", "audio").contains(type == null ? "" : type)) throw invalid("请选择图片、视频或音频");
        long max = ("image".equals(type) ? 8 : "video".equals(type) ? 128 : 25) * MIB;
        if (file == null || file.isEmpty()) throw invalid("文件是空的，请重新选择");
        if (file.getSize() > max) throw invalid("文件超过 " + max / MIB + " MB，请压缩后重试");
        byte[] bytes;
        try { bytes = file.getBytes(); } catch (Exception e) { throw invalid("文件读取失败，请重新选择"); }
        if (bytes.length == 0 || bytes.length > max) throw invalid("文件大小不符合要求，请重新选择");
        var format = MediaBytes.sniff(type, bytes);
        if (format == null || "image".equals(type) && !Set.of("jpg", "jpeg", "png").contains(format.ext())
                || "audio".equals(type) && !Set.of("mp3", "wav", "m4a").contains(format.ext()))
            throw invalid("支持 JPG / PNG 图片、MP4 视频和 MP3 / WAV / M4A 音频，请检查文件内容");
        Integer width = null, height = null; Double duration = null;
        if ("image".equals(type)) {
            try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                if (input == null) throw invalid("图片无法读取");
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid("图片无法读取");
                var reader = readers.next();
                try { reader.setInput(input, true, true); width = reader.getWidth(0); height = reader.getHeight(0); }
                finally { reader.dispose(); }
                if (width < 1 || height < 1 || width > 8000 || height > 8000 || (long)width * height > 24_000_000)
                    throw invalid("图片最长边不能超过 8000 像素，总像素不能超过 2400 万");
            } catch (BusinessException e) { throw e; } catch (Exception e) { throw invalid("图片内容无法读取，请换一张图片"); }
        } else {
            Path tmp = null;
            try {
                tmp = Files.createTempFile("studio-import-", "." + format.ext()); Files.write(tmp, bytes);
                var probe = ffmpeg.probeMedia(tmp.toFile());
                if (!probe.readable() || !Double.isFinite(probe.durationSec()) || probe.durationSec() <= 0
                        || "video".equals(type) && !probe.hasVideo() || "audio".equals(type) && (!probe.hasAudio() || probe.hasVideo()))
                    throw invalid("文件没有可读取的画面或声音，请重新选择");
                double maxSeconds = "video".equals(type) ? 60 : 600;
                if (probe.durationSec() > maxSeconds) throw invalid("视频最多 60 秒，音频最多 10 分钟，请先剪短");
                if ("video".equals(type)) {
                    if (!"h264".equals(probe.videoCodec()) || probe.hasAudio() && !"aac".equals(probe.audioCodec()))
                        throw invalid("视频请使用 H.264 画面、AAC 音轨的 MP4 文件");
                    width = probe.width(); height = probe.height();
                    if (width < 1 || height < 1 || (long)width * height > 24_000_000) throw invalid("视频尺寸无法读取或过大");
                }
                duration = probe.durationSec();
            } catch (BusinessException e) { throw e; } catch (Exception e) { throw invalid("音视频无法读取，请重新选择"); }
            finally { if (tmp != null) try { Files.deleteIfExists(tmp); } catch (Exception ignored) {} }
        }
        quota.checkQuota("aiavatar", user, bytes.length);
        // Existing owned source namespace; signed URLs are returned only on the wire.
        var stored = storage.store(bytes, "ipstudio/source", user, format.ext(), format.mime());
        quota.record("aiavatar", user, "画布附件", null, stored.key(), stored.bytes());
        String name = file.getOriginalFilename() == null ? "画布附件" : file.getOriginalFilename().replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").strip();
        if (name.isBlank()) name = "画布附件";
        name = name.substring(0, name.offsetByCodePoints(0, Math.min(100, name.codePointCount(0, name.length()))));
        return new MediaImportResult(stored.key(), storage.signedUrl(stored.key()), type, format.mime(), stored.bytes(), name, width, height, duration);
    }
    private BusinessException invalid(String message) { return BusinessException.badRequest("STUDIO_MEDIA_INVALID", message); }
}
