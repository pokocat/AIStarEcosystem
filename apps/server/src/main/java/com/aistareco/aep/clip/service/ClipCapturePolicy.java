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

/** 石榴官方硬限制 + 军师采集建议。较长的建议时长只用于提示，不得变成提交硬门槛。 */
@Service
public class ClipCapturePolicy {
    public static final String CONSENT_TEXT = "我是本次出镜者本人，特此声明，我授权军师参谋部使用我提交的视频和声音资料，为我的账号创建数字分身，并仅在我的账号中使用它。";
    private static final long VENDOR_VIDEO_MAX_BYTES = 200L * 1024 * 1024;
    private static final long VIDEO_MAX_BYTES = 100L * 1024 * 1024;
    private static final long AUDIO_MAX_BYTES = 20L * 1024 * 1024;
    private static final Set<String> VIDEO_MIME = Set.of("video/mp4", "video/quicktime");
    private static final Set<String> AUDIO_MIME = Set.of("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/x-m4a");
    private static final long IMAGE_MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> IMAGE_MIME = Set.of("image/jpeg", "image/png");
    /** 图片训练数字人（石榴 /avatar/createByImage）。与视频训练同为 avatar 类，但采集口径完全不同。 */
    public static final String IMAGE_KIND = "avatarImage";

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
        CaptureRuleDto avatar = new CaptureRuleDto("avatar", 5, 300, 5, 10, 20, 300, VENDOR_VIDEO_MAX_BYTES, VIDEO_MAX_BYTES,
                List.of("mp4", "mov"), List.of("mp4", "mov"), "H.264", 360, 4096, null, null,
                List.of("5 秒即可提交，建议竖屏连续录 10 至 20 秒", "推荐 720p，上半身完整入镜", "手机固定、光线均匀，正脸自然说话", "不要戴口罩、墨镜或遮挡面部"));
        // 石榴要求声音样本 > 2 秒；端上按整秒展示为至少 3 秒，避免卡在边界值。
        CaptureRuleDto voice = new CaptureRuleDto("voice", 2, 0, 3, 8, 15, 120, AUDIO_MAX_BYTES, AUDIO_MAX_BYTES,
                List.of("wav", "mp3", "ogg", "m4a", "aac", "pcm"), List.of("wav", "mp3", "ogg", "m4a", "aac"), null, null, null, 44100, 1,
                List.of("超过 2 秒即可提交，建议连续录 8 至 15 秒", "只保留一位说话人，关闭音乐和环境声", "离手机约 20 厘米，用平时语速自然朗读", "避免长时间停顿"));
        // 图片训练没有时长概念：所有时长字段给 0，端上据此**不展示秒数**，而不是显示「至少 0 秒」。
        CaptureRuleDto image = new CaptureRuleDto(IMAGE_KIND, 0, 0, 0, 0, 0, 0, IMAGE_MAX_BYTES, IMAGE_MAX_BYTES,
                List.of("jpg", "jpeg", "png"), List.of("jpg", "jpeg", "png"), null, 360, 4096, null, null,
                List.of("一张清晰正脸照，五官不要被遮挡", "建议竖版半身，人物在画面中央", "不要用合影、侧脸或大角度俯仰", "图片本身没有声音，需要先选一条已训好的声音"));
        return new CaptureRequirementsDto(false, CONSENT_TEXT, "数字分身素材使用说明", "2026-08-11",
                List.of("https://api.16ai.vip/doc-4892856", "https://api.16ai.vip/api-295432904", "https://api.16ai.vip/api-198837531", "https://api.16ai.vip/api-198853492"),
                consent, avatar, voice, image, 5_000);
    }

    public FfmpegRunner.MediaProbe validate(String kind, MultipartFile file, FileStorageService.StoredFile stored) {
        if (file == null || stored == null) throw BusinessException.badRequest("CLIP_CAPTURE_REQUIRED", "未收到采集文件");
        return validate(kind, file.getOriginalFilename(), file.getContentType(), stored);
    }

    /** 直传对象没有 MultipartFile；文件名/MIME 来自已签入上传会话的声明，真实媒体仍由 ffprobe/ImageIO 验。 */
    public FfmpegRunner.MediaProbe validate(String kind, String fileName, String contentType, FileStorageService.StoredFile stored) {
        if (stored == null) throw BusinessException.badRequest("CLIP_CAPTURE_REQUIRED", "未收到采集文件");
        // 图片单独走一条：静态图没有时长，套用下面的 durationSec > 0 校验会把每一张合法图片都判死。
        if (IMAGE_KIND.equals(kind)) return validateImage(fileName, contentType, stored);
        String mime = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        boolean voice = "voice".equals(kind);
        String extension = extension(fileName);
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

    /**
     * 图片采集校验。**不走 ffprobe** —— 它对静态图的时长/流信息表现不一致，容易把合法图片判成不可读。
     * 改用 JDK 自带的 ImageIO：能解码出来才算数，比魔数判断更实在（顺带拿到真实像素尺寸）。
     */
    private FfmpegRunner.MediaProbe validateImage(String fileName, String contentType, FileStorageService.StoredFile stored) {
        String mime = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String extension = extension(fileName);
        if (!IMAGE_MIME.contains(mime)) {
            throw BusinessException.badRequest("CLIP_CAPTURE_FORMAT_INVALID", "照片只支持 JPG 或 PNG");
        }
        if (!Set.of("jpg", "jpeg", "png").contains(extension)) {
            throw BusinessException.badRequest("CLIP_CAPTURE_EXTENSION_INVALID", "照片扩展名需要是 JPG 或 PNG");
        }
        if (stored.bytes() <= 0 || stored.bytes() > IMAGE_MAX_BYTES) {
            throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "CLIP_CAPTURE_TOO_LARGE", "照片不能超过 10MB");
        }
        final java.awt.image.BufferedImage img;
        try { img = javax.imageio.ImageIO.read(storage.openForRead(stored.key()).toFile()); }
        catch (Exception e) {
            throw BusinessException.wrapped(HttpStatus.UNPROCESSABLE_ENTITY, "CLIP_CAPTURE_UNREADABLE", "照片无法读取，请重新选择", e.toString());
        }
        if (img == null) throw BusinessException.badRequest("CLIP_CAPTURE_UNREADABLE", "照片无法读取，请重新选择");
        int shortSide = Math.min(img.getWidth(), img.getHeight());
        int longSide = Math.max(img.getWidth(), img.getHeight());
        // 与视频同一档口径：上传分辨率决定成片分辨率，太小的图出不了能看的片。
        if (shortSide < 360 || longSide > 4096) {
            throw BusinessException.badRequest("CLIP_IMAGE_RESOLUTION_INVALID", "照片分辨率需在 360p 到 4K 之间");
        }
        return new FfmpegRunner.MediaProbe(0, extension, null, null, img.getWidth(), img.getHeight(), 0, 0, true);
    }

    /** 发上传票前的廉价门：只验声明，避免超限/错格式文件先占满带宽；深度校验仍在上传后。 */
    public void validateDeclaration(String kind, String fileName, String contentType, long bytes) {
        if (!Set.of("avatar", "voice", IMAGE_KIND).contains(kind)) {
            throw BusinessException.badRequest("CLIP_CLONE_KIND_INVALID", "采集类型不支持");
        }
        String mime = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String ext = extension(fileName);
        if (IMAGE_KIND.equals(kind)) {
            if (!IMAGE_MIME.contains(mime) || !Set.of("jpg", "jpeg", "png").contains(ext)) {
                throw BusinessException.badRequest("CLIP_CAPTURE_FORMAT_INVALID", "照片只支持 JPG 或 PNG");
            }
            if (bytes < 1 || bytes > IMAGE_MAX_BYTES) throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "CLIP_CAPTURE_TOO_LARGE", "照片不能超过 10MB");
            return;
        }
        boolean voice = "voice".equals(kind);
        Set<String> extensions = voice ? Set.of("wav", "mp3", "ogg", "m4a", "aac") : Set.of("mp4", "mov");
        if (voice ? !AUDIO_MIME.contains(mime) : !VIDEO_MIME.contains(mime)) {
            throw BusinessException.badRequest("CLIP_CAPTURE_FORMAT_INVALID", voice ? "声音只支持 WAV、MP3、OGG、M4A 或 AAC" : "视频只支持 MP4 或 MOV");
        }
        if (!extensions.contains(ext)) throw BusinessException.badRequest("CLIP_CAPTURE_EXTENSION_INVALID", voice ? "声音文件扩展名需要是 WAV、MP3、OGG、M4A 或 AAC" : "视频文件扩展名需要是 MP4 或 MOV");
        long max = voice ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
        if (bytes < 1 || bytes > max) throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE, "CLIP_CAPTURE_TOO_LARGE", voice ? "声音文件不能超过 20MB" : "视频文件不能超过 100MB");
    }

    private static void validateVoice(FfmpegRunner.MediaProbe probe, String extension) {
        if (!probe.hasAudio()) throw BusinessException.badRequest("CLIP_VOICE_TRACK_REQUIRED", "录音里没有识别到声音");
        if (!containerMatches(extension, probe.format())) throw BusinessException.badRequest("CLIP_CAPTURE_CONTAINER_MISMATCH", "声音扩展名与实际格式不一致，请重新录制");
        if (probe.durationSec() <= 2) throw BusinessException.badRequest("CLIP_VOICE_TOO_SHORT", "声音需要超过 2 秒，建议连续录制 8 至 15 秒");
        if (probe.durationSec() > 120) throw BusinessException.badRequest("CLIP_VOICE_TOO_LONG", "单次声音采集不能超过 2 分钟");
    }

    private static void validateVideo(String kind, FfmpegRunner.MediaProbe probe, String extension) {
        if (!probe.hasVideo()) throw BusinessException.badRequest("CLIP_VIDEO_TRACK_REQUIRED", "没有识别到有效视频画面");
        if (!containerMatches(extension, probe.format())) throw BusinessException.badRequest("CLIP_CAPTURE_CONTAINER_MISMATCH", "视频扩展名与实际格式不一致，请用小程序相机重新录制");
        if (!"h264".equalsIgnoreCase(probe.videoCodec())) throw BusinessException.badRequest("CLIP_VIDEO_CODEC_INVALID", "视频需要使用 H.264 编码，请用小程序相机重新录制");
        double max = "consent".equals(kind) ? 30 : 300;
        double min = 5;
        if (probe.durationSec() < min) throw BusinessException.badRequest("CLIP_VIDEO_TOO_SHORT", "视频至少要连续录制 5 秒");
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
