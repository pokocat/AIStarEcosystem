package com.aistareco.aep.videostudio.service;

import com.aistareco.aep.service.materialvideo.JusuanH3Contract;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.MediaBytes;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioUpload;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.Locale;

/**
 * 视频生成区的素材上传（{@code POST /me/celebrity/video-studio/uploads}，docs/video-studio-plan.md §5.5）。
 *
 * <p>顺序：类型 → 空 / 大小 → **按字节**判格式（后缀用判出来的，不信文件名，§8.0.1 ⑤）→
 * 音视频过 ffprobe（临时文件，用完即删）→ 存储配额 → 落存储 → 记用量。
 *
 * <p>**key 里的分类就是验过的类型**（{@code video-studio-image|video|audio/<uid>/…}）。提交任务时
 * 归属闸据此判「是不是本人在这里上传的、类型对不对」（{@link #categoryOf} 是这条约定唯一的出处）。
 */
@Service
public class VideoStudioUploadService {

    private static final Logger log = LoggerFactory.getLogger(VideoStudioUploadService.class);

    /** 存储用量记在明星带货这个子应用下。 */
    static final String STORAGE_APP = "celebrity";
    /** 存储用量里的分类名（成片是「视频生成」，这是素材）。 */
    static final String STORAGE_CATEGORY = "视频生成素材";

    private static final long MIB = 1024L * 1024L;

    private final FileStorageService fileStorage;
    private final StorageQuotaService quota;
    private final FfmpegRunner ffmpeg;

    public VideoStudioUploadService(FileStorageService fileStorage, StorageQuotaService quota, FfmpegRunner ffmpeg) {
        this.fileStorage = fileStorage;
        this.quota = quota;
        this.ffmpeg = ffmpeg;
    }

    /** 某类素材在存储里的分类（key 的第一段）。上传写它，提交时的归属闸读它。 */
    public static String categoryOf(String mediaType) {
        return "video-studio-" + mediaType;
    }

    /** 上传单个文件的上限：图 30 MiB / 视频 50 MiB / 音频 15 MiB（厂商全能参考的单项上限）。 */
    static long maxBytesOf(String mediaType) {
        return JusuanH3Contract.referenceMaxBytes(mediaType);
    }

    public VideoStudioUpload upload(String userId, MultipartFile file, String mediaType) {
        String type = mediaType == null ? "" : mediaType.trim().toLowerCase(Locale.ROOT);
        if (!JusuanH3Contract.isMediaType(type)) {
            throw BusinessException.badRequest("VIDEO_STUDIO_FORMAT_UNSUPPORTED", "素材类型只能是图片、视频或音频");
        }
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("VIDEO_STUDIO_FILE_EMPTY", "文件是空的，请重新选择");
        }
        long limit = maxBytesOf(type);
        // 先看声明大小再读字节：超限的大文件不必整个读进内存。
        if (file.getSize() > limit) throw tooLarge(type, file.getSize(), limit);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.warn("[video-studio] 读取上传文件失败 user={} type={} err={}", userId, type, e.toString());
            throw BusinessException.badRequest("VIDEO_STUDIO_MEDIA_UNREADABLE", "文件读不出来，请重新上传");
        }
        if (bytes.length == 0) {
            throw BusinessException.badRequest("VIDEO_STUDIO_FILE_EMPTY", "文件是空的，请重新选择");
        }
        if (bytes.length > limit) throw tooLarge(type, bytes.length, limit);

        MediaBytes.Format fmt = MediaBytes.sniff(type, bytes);
        if (fmt == null) {
            throw BusinessException.badRequest("VIDEO_STUDIO_FORMAT_UNSUPPORTED",
                    typeName(type) + "只支持 " + String.join("、", JusuanH3Contract.formatsOf(type)) + " 格式");
        }

        Double durationSec = null;
        Integer width = null;
        Integer height = null;
        if (JusuanH3Contract.MEDIA_IMAGE.equals(type)) {
            int[] size = imageSize(bytes);
            if (size != null) {
                width = size[0];
                height = size[1];
            }
        } else {
            FfmpegRunner.MediaProbe probe = probe(bytes, fmt.ext());
            if (!probe.readable()) {
                throw BusinessException.badRequest("VIDEO_STUDIO_MEDIA_UNREADABLE", "这个" + typeName(type) + "读不出来，请换一个文件");
            }
            if (JusuanH3Contract.MEDIA_VIDEO.equals(type)) {
                if (!probe.hasVideo()) {
                    throw BusinessException.badRequest("VIDEO_STUDIO_MEDIA_UNREADABLE", "这个视频里没有画面，请换一个文件");
                }
                if (probe.durationSec() > 0) durationSec = probe.durationSec();
                if (probe.width() > 0 && probe.height() > 0) {
                    width = probe.width();
                    height = probe.height();
                }
            } else {
                if (!probe.hasAudio()) {
                    throw BusinessException.badRequest("VIDEO_STUDIO_MEDIA_UNREADABLE", "这个文件里没有声音，请换一个文件");
                }
                double d = probe.durationSec();
                if (d < JusuanH3Contract.AUDIO_MIN_SECONDS || d > JusuanH3Contract.AUDIO_MAX_SECONDS) {
                    throw BusinessException.badRequest("VIDEO_STUDIO_AUDIO_DURATION_INVALID",
                            "每段音频要在 " + JusuanH3Contract.AUDIO_MIN_SECONDS + " 到 " + JusuanH3Contract.AUDIO_MAX_SECONDS
                                    + " 秒之间，这段是 " + oneDecimal(d) + " 秒");
                }
                durationSec = d;
            }
        }

        // 存储配额前置：已知本次文件大小，超额直接拒（402 STORAGE_QUOTA_EXCEEDED，不写文件、不记账）。
        quota.checkQuota(STORAGE_APP, userId, bytes.length);
        FileStorageService.StoredFile stored = fileStorage.store(bytes, categoryOf(type), userId, fmt.ext(), fmt.mime());
        quota.record(STORAGE_APP, userId, STORAGE_CATEGORY, null, stored.key(), stored.bytes());
        log.info("[video-studio] 素材已上传 user={} type={} format={} bytes={} key={}",
                userId, type, fmt.ext(), stored.bytes(), stored.key());
        return new VideoStudioUpload(stored.key(), fileStorage.signedUrl(stored.key()), type, stored.bytes(),
                displayName(file.getOriginalFilename(), type), durationSec, width, height);
    }

    // ── 探测 ────────────────────────────────────────────────────────────────

    /** ffprobe 要文件路径：写一个临时文件，探完立刻删掉（成功失败都删）。 */
    private FfmpegRunner.MediaProbe probe(byte[] bytes, String ext) {
        Path tmp = null;
        try {
            tmp = Files.createTempFile("video-studio-upload-", "." + ext);
            Files.write(tmp, bytes);
            return ffmpeg.probeMedia(tmp.toFile());
        } catch (IOException e) {
            log.warn("[video-studio] 写临时文件失败 ext={} err={}", ext, e.toString());
            return new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException e) {
                    log.warn("[video-studio] 临时文件没删掉 path={} err={}", tmp, e.toString());
                }
            }
        }
    }

    /**
     * 图片像素只读**文件头**（{@code reader.getWidth/getHeight}），不整图解码 —— 一张很小的 PNG 可以声明
     * 几万像素见方，整图解码会瞬间吃掉大量堆（ipstudio 上传同一条教训）。读不到（如 JDK 没有 WebP 读取器）返回 null。
     */
    static int[] imageSize(byte[] bytes) {
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (iis == null) return null;
            Iterator<ImageReader> readers = ImageIO.getImageReaders(iis);
            if (!readers.hasNext()) return null;
            ImageReader reader = readers.next();
            try {
                reader.setInput(iis, true, true);
                return new int[]{reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (Exception e) {
            return null;
        }
    }

    // ── 文案 ────────────────────────────────────────────────────────────────

    private static BusinessException tooLarge(String type, long actualBytes, long limitBytes) {
        return BusinessException.badRequest("VIDEO_STUDIO_FILE_TOO_LARGE",
                typeName(type) + "不能超过 " + (limitBytes / MIB) + "MB，这个文件有 " + ceilMb(actualBytes) + "MB");
    }

    private static String typeName(String mediaType) {
        if (JusuanH3Contract.MEDIA_VIDEO.equals(mediaType)) return "视频";
        if (JusuanH3Contract.MEDIA_AUDIO.equals(mediaType)) return "音频";
        return "图片";
    }

    private static long ceilMb(long bytes) {
        return bytes / MIB + (bytes % MIB == 0 ? 0 : 1);
    }

    /** 一位小数，向上取（15.02 秒显示成 15.1，不会出现「不能超过 15 秒，这段是 15.0 秒」）。 */
    static String oneDecimal(double seconds) {
        return String.format(Locale.ROOT, "%.1f", Math.ceil(seconds * 10) / 10);
    }

    /** 展示用文件名：去掉路径和控制字符，最长 100 个字；没有就按类型给个默认名。 */
    static String displayName(String original, String mediaType) {
        String n = original == null ? "" : original;
        int slash = Math.max(n.lastIndexOf('/'), n.lastIndexOf('\\'));
        if (slash >= 0) n = n.substring(slash + 1);
        n = n.replaceAll("\\p{Cntrl}", "").strip();
        if (n.isEmpty()) return typeName(mediaType);
        if (n.codePointCount(0, n.length()) > 100) n = n.substring(0, n.offsetByCodePoints(0, 100));
        return n;
    }
}
