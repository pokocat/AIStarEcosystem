package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;

/** iPhone 相册常见 HEVC/H.265 在服务端统一转 H.264，避免用户上传几十秒后才被一句编码错误打回。 */
@Service
public class ClipCaptureNormalizer {
    public record Prepared(String fileName, String contentType, FileStorageService.StoredFile stored, boolean transcoded) {}

    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    public ClipCaptureNormalizer(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    public Prepared prepare(String owner, String kind, String fileName, String contentType, FileStorageService.StoredFile stored) {
        if (!"avatar".equals(kind)) return new Prepared(fileName, contentType, stored, false);
        final Path source;
        final FfmpegRunner.MediaProbe probe;
        try {
            source = storage.openForRead(stored.key());
            probe = ffmpeg.probeMedia(source.toFile());
        } catch (Exception error) {
            throw BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_CAPTURE_UNREADABLE", "采集文件无法读取，请重新录制", error.toString());
        }
        String codec = probe.videoCodec() == null ? "" : probe.videoCodec().toLowerCase(Locale.ROOT);
        if (!SetLike.hevc(codec)) return new Prepared(fileName, contentType, stored, false);

        Path output = null;
        try {
            output = Files.createTempFile("clip-h264-", ".mp4");
            ffmpeg.runFfmpeg(List.of(
                    "-y", "-i", source.toString(),
                    "-map", "0:v:0", "-map", "0:a?",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                    output.toString()
            ));
            FileStorageService.StoredFile normalized = storage.storeExisting(output, "clip/clone/avatar", owner, "mp4", "video/mp4", true);
            storage.delete(stored.key());
            return new Prepared(replaceExtension(fileName, "mp4"), "video/mp4", normalized, true);
        } catch (RuntimeException | java.io.IOException error) {
            if (output != null) try { Files.deleteIfExists(output); } catch (Exception ignored) {}
            throw BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_VIDEO_TRANSCODE_FAILED", "视频正在兼容处理时失败，请重新选择或录制", error.toString());
        }
    }

    private static String replaceExtension(String fileName, String ext) {
        String clean = fileName == null || fileName.isBlank() ? "avatar" : fileName;
        int dot = clean.lastIndexOf('.');
        return (dot > 0 ? clean.substring(0, dot) : clean) + "." + ext;
    }

    private static final class SetLike {
        private static boolean hevc(String codec) { return "hevc".equals(codec) || "h265".equals(codec) || "h.265".equals(codec); }
    }
}
