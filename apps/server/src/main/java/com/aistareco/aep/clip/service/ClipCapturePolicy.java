package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos.CaptureRequirementsDto;
import com.aistareco.aep.clip.dto.ClipDtos.CaptureRuleDto;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** 石榴官方硬限制 + 军师采集质量门。官方硬限制与产品建议在 DTO 中分开表达。 */
@Service
public class ClipCapturePolicy {
    public static final String CONSENT_TEXT = "我是本次出镜者本人，特此声明，我授权军师参谋部使用我提交的视频和声音资料，为我的账号创建数字分身，并仅在我的账号中使用它。";
    private static final long VENDOR_VIDEO_MAX_BYTES = 200L * 1024 * 1024;
    private static final long VIDEO_MAX_BYTES = 100L * 1024 * 1024;
    private static final long AUDIO_MAX_BYTES = 20L * 1024 * 1024;
    private static final Set<String> VIDEO_MIME = Set.of("video/mp4", "video/quicktime");
    private static final Set<String> AUDIO_MIME = Set.of("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a");

    private final FileStorageService storage;
    private final FfmpegRunner ffmpeg;

    public ClipCapturePolicy(FileStorageService storage, FfmpegRunner ffmpeg) {
        this.storage = storage;
        this.ffmpeg = ffmpeg;
    }

    public CaptureRequirementsDto requirements() {
        CaptureRuleDto consent = new CaptureRuleDto("consent", 5, 300, 5, 8, 20, 30, VENDOR_VIDEO_MAX_BYTES, VIDEO_MAX_BYTES,
                List.of("mp4", "mov"), List.of("mp4", "mov"), "H.264", 360, 4096, null, null,
                List.of("本人正脸看镜头并完整念出授权文字", "画面和声音必须连续、清楚，不能剪辑拼接"));
        CaptureRuleDto avatar = new CaptureRuleDto("avatar", 5, 300, 15, 20, 60, 300, VENDOR_VIDEO_MAX_BYTES, VIDEO_MAX_BYTES,
                List.of("mp4", "mov"), List.of("mp4", "mov"), "H.264", 360, 4096, null, null,
                List.of("推荐竖屏 720p，上半身完整入镜", "手机固定、光线均匀，正脸自然说话", "不要戴口罩、墨镜或遮挡面部"));
        CaptureRuleDto voice = new CaptureRuleDto("voice", 2, 0, 20, 30, 60, 120, AUDIO_MAX_BYTES, AUDIO_MAX_BYTES,
                List.of("wav", "mp3", "ogg", "m4a", "aac", "pcm"), List.of("wav", "mp3", "ogg", "m4a", "aac"), null, null, null, 44100, 1,
                List.of("只保留一位说话人，关闭音乐和环境声", "离手机约 20 厘米，用平时语速完整朗读", "建议连续录 30 至 60 秒，避免长时间停顿"));
        return new CaptureRequirementsDto(CONSENT_TEXT, "数字分身本人授权书", "2026-08-11",
                List.of("https://api.16ai.vip/doc-4892856", "https://api.16ai.vip/api-295432904", "https://api.16ai.vip/api-198837531", "https://api.16ai.vip/api-198853492"),
                consent, avatar, voice, 5_000);
    }

    public FfmpegRunner.MediaProbe validate(String kind, MultipartFile file, FileStorageService.StoredFile stored) {
        if (file == null || stored == null) throw BusinessException.badRequest("CLIP_CAPTURE_REQUIRED", "未收到采集文件");
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean voice = "voice".equals(kind);
        String extension = extension(file.getOriginalFilename());
        Set<String> supportedExtensions = voice ? Set.of("wav", "mp3", "ogg", "m4a", "aac") : Set.of("mp4", "mov");
        if (voice ? !AUDIO_MIME.contains(mime) : !VIDEO_MIME.contains(mime)) {
            throw BusinessException.badRequest("CLIP_CAPTURE_FORMAT_INVALID", voice ? "声音只支持 WAV、MP3、OGG、M4A 或 AAC" : "视频只支持 MP4 或 MOV");
        }
        if (!supportedExtensions.contains(extension)) {
            throw BusinessException.badRequest("CLIP_CAPTURE_EXTENSION_INVALID", voice ? "声音文件扩展名需要是 WAV、MP3、OGG、M4A 或 AAC" : "视频文件扩展名需要是 MP4 或 MOV");
        }
        long max = voice ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
        if (stored.bytes() <= 0 || stored.bytes() > max) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "CLIP_CAPTURE_TOO_LARGE", voice ? "声音文件不能超过 20MB" : "视频文件不能超过 100MB");
        }
        final FfmpegRunner.MediaProbe probe;
        try {
            Path path = storage.openForRead(stored.key());
            probe = ffmpeg.probeMedia(path.toFile());
        } catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_CAPTURE_UNREADABLE", "采集文件无法读取，请重新录制", e.toString());
        }
        if (!probe.readable() || probe.durationSec() <= 0) {
            throw BusinessException.badRequest("CLIP_CAPTURE_UNREADABLE", "采集文件无法读取，请重新录制");
        }
        if (voice) validateVoice(probe, extension);
        else validateVideo(kind, probe, extension);
        return probe;
    }

    private static void validateVoice(FfmpegRunner.MediaProbe probe, String extension) {
        if (!probe.hasAudio()) throw BusinessException.badRequest("CLIP_VOICE_TRACK_REQUIRED", "录音里没有识别到声音");
        if (!containerMatches(extension, probe.format())) throw BusinessException.badRequest("CLIP_CAPTURE_CONTAINER_MISMATCH", "声音扩展名与实际格式不一致，请重新录制");
        if (probe.durationSec() < 20) throw BusinessException.badRequest("CLIP_VOICE_TOO_SHORT", "为保证声音还原效果，请至少连续录制 20 秒，建议完整朗读 30 至 60 秒");
        if (probe.durationSec() > 120) throw BusinessException.badRequest("CLIP_VOICE_TOO_LONG", "单次声音采集不能超过 2 分钟");
    }

    private static void validateVideo(String kind, FfmpegRunner.MediaProbe probe, String extension) {
        if (!probe.hasVideo()) throw BusinessException.badRequest("CLIP_VIDEO_TRACK_REQUIRED", "没有识别到有效视频画面");
        if (!containerMatches(extension, probe.format())) throw BusinessException.badRequest("CLIP_CAPTURE_CONTAINER_MISMATCH", "视频扩展名与实际格式不一致，请用小程序相机重新录制");
        if (!"h264".equalsIgnoreCase(probe.videoCodec())) throw BusinessException.badRequest("CLIP_VIDEO_CODEC_INVALID", "视频需要使用 H.264 编码，请用小程序相机重新录制");
        double max = "consent".equals(kind) ? 30 : 300;
        double min = "avatar".equals(kind) ? 15 : 5;
        if (probe.durationSec() < min) throw BusinessException.badRequest("CLIP_VIDEO_TOO_SHORT", "avatar".equals(kind) ? "为保证分身稳定，请至少连续录制 15 秒" : "视频至少要连续录制 5 秒");
        if (probe.durationSec() > max) throw BusinessException.badRequest("CLIP_VIDEO_TOO_LONG", "consent".equals(kind) ? "授权视频不能超过 30 秒" : "形象视频不能超过 5 分钟");
        int shortSide = Math.min(probe.width(), probe.height());
        int longSide = Math.max(probe.width(), probe.height());
        if (shortSide < 360 || longSide > 4096) throw BusinessException.badRequest("CLIP_VIDEO_RESOLUTION_INVALID", "视频分辨率需在 360p 到 4K 之间");
    }

    private static String extension(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        return dot < 0 || dot == filename.length() - 1 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean containerMatches(String extension, String format) {
        String actual = format == null ? "" : format.toLowerCase(Locale.ROOT);
        return switch (extension) {
            case "mp4", "mov", "m4a" -> actual.contains("mov") || actual.contains("mp4") || actual.contains("m4a");
            case "wav" -> actual.contains("wav");
            case "mp3" -> actual.contains("mp3");
            case "ogg" -> actual.contains("ogg");
            case "aac" -> actual.contains("aac");
            default -> false;
        };
    }
}
