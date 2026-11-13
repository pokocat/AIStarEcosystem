package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;

/** Adapts an owned ReShot control video to Ark's reference input dimensions after motion extraction. */
final class StudioSeedanceControlVideo {
    private static final Logger log = LoggerFactory.getLogger(StudioSeedanceControlVideo.class);
    private static final int MIN_PIXELS = 407_696;
    private static final int MIN_EDGE = 300;
    private static final double MIN_RATIO = 0.4;
    private static final long MAX_BYTES = 200L * 1024 * 1024;
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    StudioSeedanceControlVideo(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    static boolean appliesTo(String model) {
        return model != null && model.strip().toLowerCase(Locale.ROOT)
                .matches("(?:doubao-)?seedance-2[.-]0(?:-[a-z0-9]+)*");
    }

    String prepare(String owner, String sourceKey) {
        try {
            var source = storage.openForRead(sourceKey);
            var input = ffmpeg.probeMedia(source.toFile());
            if (!input.readable() || !input.hasVideo() || input.width() <= 0 || input.height() <= 0
                    || !Double.isFinite(input.durationSec()) || input.durationSec() <= 0)
                throw new IOException("Unreadable control video");
            var size = inputSize(input.width(), input.height());
            if (size.width() == input.width() && size.height() == input.height()) return sourceKey;

            String category = IpProjectService.CATEGORY_GEN;
            // The workflow holds the project lock. Retry the same control step with the same validated file and receipt.
            String id = UUID.nameUUIDFromBytes(sourceKey.getBytes(StandardCharsets.UTF_8)).toString();
            String key = FileStorageService.ownedKeyPrefix(category, owner) + "seedance-control-" + id + ".mp4";
            var existing = storage.stat(key);
            if (existing != null && existing.bytes() > 0 && existing.bytes() <= MAX_BYTES) return key;
            return resize(source, input, size, owner, key);
        } catch (Exception error) {
            log.warn("[studio-video] Seedance control video preparation failed key={} reason={}", sourceKey,
                    error.getClass().getSimpleName());
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STUDIO_DEPTH_REFERENCE_PREPARE_FAILED",
                    "动作参考视频处理失败，请重试当前步骤");
        }
    }

    private String resize(Path source, FfmpegRunner.MediaProbe input, Size size, String owner, String key)
            throws IOException {
        var output = Files.createTempFile("studio-seedance-control-", ".mp4");
        try {
            String canvas = size.width() + ":" + size.height();
            ffmpeg.runFfmpeg(List.of("-v", "error", "-nostdin", "-y", "-threads", "2", "-i", source.toString(),
                    "-map", "0:v:0", "-an", "-vf",
                    "scale=" + canvas + ":force_original_aspect_ratio=decrease:force_divisible_by=2"
                            + ",pad=" + canvas + ":(ow-iw)/2:(oh-ih)/2,setsar=1",
                    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", output.toString()), 60_000);
            var result = ffmpeg.probeMedia(output.toFile());
            long bytes = Files.size(output);
            if (!result.readable() || !"h264".equals(result.videoCodec()) || result.width() != size.width()
                    || result.height() != size.height() || !Double.isFinite(result.durationSec())
                    || Math.abs(result.durationSec() - input.durationSec()) > 0.05 || bytes <= 0 || bytes > MAX_BYTES)
                throw new IOException("Adapted control video failed validation");
            return storage.storeAllocated(output, IpProjectService.CATEGORY_GEN, owner, key, "video/mp4").key();
        } finally {
            Files.deleteIfExists(output);
        }
    }

    record Size(int width, int height) {}

    static Size inputSize(int width, int height) {
        double ratio = (double) width / height;
        if (width >= MIN_EDGE && height >= MIN_EDGE && (long) width * height >= MIN_PIXELS
                && ratio >= MIN_RATIO && ratio <= 1 / MIN_RATIO)
            return new Size(width, height);

        // For unusually narrow or wide control videos, pad the canvas and preserve the entire motion field.
        double canvasWidth = Math.max(width, height * MIN_RATIO);
        double canvasHeight = Math.max(height, width * MIN_RATIO);
        double scale = Math.max(1, Math.max(MIN_EDGE / Math.min(canvasWidth, canvasHeight),
                Math.sqrt(MIN_PIXELS / (canvasWidth * canvasHeight))));
        int targetWidth = roundUpEven(canvasWidth * scale);
        int targetHeight = roundUpEven(canvasHeight * scale);
        return new Size(Math.max(targetWidth, roundUpEven(targetHeight * MIN_RATIO)),
                Math.max(targetHeight, roundUpEven(targetWidth * MIN_RATIO)));
    }

    private static int roundUpEven(double pixels) {
        return (int) Math.ceil(pixels / 2) * 2;
    }
}
