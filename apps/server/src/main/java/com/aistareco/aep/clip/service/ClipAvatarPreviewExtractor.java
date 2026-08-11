package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** 从数字人训练视频抽一帧，作为用户确认当前形象的持久化预览图。 */
@Service
public class ClipAvatarPreviewExtractor {
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    public ClipAvatarPreviewExtractor(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    public FileStorageService.StoredFile extract(String owner, String videoKey) {
        Path output = null;
        try {
            Path input = storage.openForRead(videoKey);
            output = Files.createTempFile("clip-avatar-preview-", ".jpg");
            ffmpeg.runFfmpeg(List.of(
                    "-y", "-ss", "0.5", "-i", input.toString(), "-frames:v", "1",
                    "-vf", "scale=720:-2:force_original_aspect_ratio=decrease", "-q:v", "2", output.toString()));
            if (!Files.exists(output) || Files.size(output) <= 0) throw new IllegalStateException("empty preview");
            return storage.storeExisting(output, "clip/avatar-previews", owner, "jpg", "image/jpeg", true);
        } catch (Exception error) {
            throw BusinessException.badRequest("CLIP_AVATAR_PREVIEW_FAILED", "无法读取这段视频的画面，请重新拍摄或选择其他视频");
        } finally {
            if (output != null) {
                try { Files.deleteIfExists(output); } catch (Exception ignored) { }
            }
        }
    }
}
