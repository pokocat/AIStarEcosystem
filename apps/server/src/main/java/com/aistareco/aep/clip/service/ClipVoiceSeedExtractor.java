package com.aistareco.aep.clip.service;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

/**
 * 从用户上传的数字人视频中抽取单声道 M4A，作为“视频原声”基础音色。
 * 失败只影响可选声音增强，不能回滚已提交的 Avatar 训练。
 */
@Service
public class ClipVoiceSeedExtractor {
    private static final Logger log = LoggerFactory.getLogger(ClipVoiceSeedExtractor.class);
    private static final long MAX_AUDIO_BYTES = 20L * 1024 * 1024;
    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    public ClipVoiceSeedExtractor(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    public Optional<FileStorageService.StoredFile> extract(String owner, String videoKey) {
        Path output = null;
        try {
            Path input = storage.openForRead(videoKey);
            if (!ffmpeg.hasAudioStream(input.toFile())) return Optional.empty();
            output = Files.createTempFile("clip-avatar-voice-", ".m4a");
            ffmpeg.runFfmpeg(List.of(
                    "-y", "-i", input.toString(), "-vn", "-ac", "1", "-ar", "44100",
                    "-c:a", "aac", "-b:a", "128k", output.toString()));
            if (!Files.exists(output) || Files.size(output) <= 0 || Files.size(output) >= MAX_AUDIO_BYTES) {
                return Optional.empty();
            }
            return Optional.of(storage.storeExisting(output, "clip/clone/video-voice", owner, "m4a", "audio/mp4", true));
        } catch (Exception error) {
            log.warn("[clip-avatar] video voice extraction skipped owner={}: {}", owner, error.getMessage());
            return Optional.empty();
        } finally {
            if (output != null) {
                try { Files.deleteIfExists(output); } catch (Exception ignored) { }
            }
        }
    }
}
