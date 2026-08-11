package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** 为用户上传的视频素材生成可供小程序 image 组件直接展示的持久化 JPEG 缩略图。 */
@Service
public class ClipAssetThumbnailExtractor {
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    public ClipAssetThumbnailExtractor(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    public FileStorageService.StoredFile extract(String owner, String videoKey) throws Exception {
        Path output = null;
        try {
            Path input = storage.openForRead(videoKey);
            output = Files.createTempFile("clip-asset-thumbnail-", ".jpg");
            ffmpeg.runFfmpeg(List.of(
                    "-y", "-ss", "0.5", "-i", input.toString(), "-frames:v", "1",
                    "-vf", "scale=720:-2:force_original_aspect_ratio=decrease", "-q:v", "3", output.toString()));
            if (!Files.exists(output) || Files.size(output) <= 0) throw new IllegalStateException("empty thumbnail");
            return storage.storeExisting(output, "clip/asset-thumbnails", owner, "jpg", "image/jpeg", true);
        } finally {
            if (output != null) {
                try { Files.deleteIfExists(output); } catch (Exception ignored) { }
            }
        }
    }
}
