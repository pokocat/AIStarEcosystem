package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;

import java.io.IOException;
import java.util.Optional;

/** Seedance 2.0 input-video dimensions documented by Volcano Ark (create-video-generation-task-api). */
final class SeedanceReferenceResolution {
    static final String CODE = "VIDEO_REFERENCE_RESOLUTION_INVALID";
    private static final int MIN_EDGE = 300, MAX_EDGE = 6000;
    private static final long MIN_PIXELS = 407_696, MAX_PIXELS = 8_295_044;
    private static final String REPLACE = "请换用符合规格的参考视频，例如原始 720p 视频，再重新生成。";

    private SeedanceReferenceResolution() {}

    static Optional<String> diagnose(VideoGenSpec spec, FileStorageService storage, FfmpegRunner ffmpeg) {
        if (storage == null || ffmpeg == null) return Optional.empty();
        int index = 0;
        for (var reference : spec.references()) {
            if (!"video".equals(reference.mediaType())) continue;
            index++;
            try {
                var video = ffmpeg.probeMedia(storage.openForRead(reference.key()).toFile());
                int width = video.width(), height = video.height();
                if (video.readable() && video.hasVideo() && outsideLimits(width, height))
                    return Optional.of("参考视频" + index + "的分辨率为 " + width + "×" + height
                            + "，超出 Seedance 2.0 的参考视频输入规格。" + REPLACE);
            } catch (IOException | RuntimeException unavailable) {
                // A deleted or unreadable source cannot establish the cause of the upstream failure.
            }
        }
        return Optional.empty();
    }

    static boolean outsideLimits(int width, int height) {
        if (width <= 0 || height <= 0) return false;
        long pixels = (long) width * height;
        return width < MIN_EDGE || width > MAX_EDGE || height < MIN_EDGE || height > MAX_EDGE
                || pixels < MIN_PIXELS || pixels > MAX_PIXELS || 5L * width < 2L * height || 2L * width > 5L * height;
    }
}
