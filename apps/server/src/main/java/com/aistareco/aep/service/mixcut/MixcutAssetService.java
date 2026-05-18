package com.aistareco.aep.service.mixcut;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.model.MixcutAsset;
import com.aistareco.aep.repository.MixcutAssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 用户上传素材的 CRUD + 落 fs。
 *
 *  - upload(file, kind, userId, name)：保存到 ./mixcut-assets/<userId>/<id><ext>，写 DB
 *  - list / listByKind / listByUser / get / delete
 *  - 文件名安全 sanitize，size/mime/kind 校验
 */
@Service
public class MixcutAssetService {

    private static final Logger log = LoggerFactory.getLogger(MixcutAssetService.class);

    private static final Set<String> KIND_VALUES = Set.of("video", "image", "sticker", "bgm");

    private static final Set<String> VIDEO_MIMES = Set.of(
            "video/mp4", "video/quicktime", "video/webm", "video/x-matroska");
    private static final Set<String> IMAGE_MIMES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif");
    private static final Set<String> AUDIO_MIMES = Set.of(
            "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg");

    private static final Pattern SAFE_NAME = Pattern.compile("[^A-Za-z0-9._-]");

    private final MixcutProperties props;
    private final MixcutAssetRepository repo;
    private final FfmpegRunner ffmpeg;

    public MixcutAssetService(MixcutProperties props, MixcutAssetRepository repo, FfmpegRunner ffmpeg) {
        this.props = props;
        this.repo = repo;
        this.ffmpeg = ffmpeg;
    }

    public List<MixcutAsset> listAll(String kind, String userId) {
        if (kind != null && !kind.isBlank() && userId != null && !userId.isBlank()) {
            return repo.findByUserIdAndKindOrderByUploadedAtDesc(userId, kind);
        }
        if (kind != null && !kind.isBlank()) return repo.findByKindOrderByUploadedAtDesc(kind);
        if (userId != null && !userId.isBlank()) return repo.findByUserIdOrderByUploadedAtDesc(userId);
        return repo.findAllByOrderByUploadedAtDesc();
    }

    public Optional<MixcutAsset> get(String id) {
        return repo.findById(id);
    }

    /**
     * 上传单个素材。
     *
     * @param file        MultipartFile（必填）
     * @param kind        video / image / sticker / bgm（必填）
     * @param userId      上传者 ID（可空，将存为 "anonymous"）
     * @param displayName 用户填写的展示名（可空，将用 originalFilename）
     * @param tags        逗号分隔标签（可空）
     */
    @Transactional
    public MixcutAsset upload(MultipartFile file, String kind, String userId,
                              String displayName, String tags) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }
        String safeKind = validateKind(kind);
        validateMime(safeKind, file.getContentType());
        if (file.getSize() > props.getMaxAssetBytes()) {
            throw new IllegalArgumentException("文件超过最大限制 " + props.getMaxAssetBytes() + " 字节");
        }
        String safeUserId = (userId == null || userId.isBlank()) ? "anonymous" : sanitize(userId);

        String id = "asset_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String ext = guessExt(file.getOriginalFilename(), file.getContentType());
        String storedName = id + ext;

        File userDir = new File(props.getAssetDir(), safeUserId);
        if (!userDir.exists() && !userDir.mkdirs()) {
            throw new IOException("Cannot create asset dir: " + userDir.getAbsolutePath());
        }
        File target = new File(userDir, storedName);

        try (var in = file.getInputStream()) {
            Files.copy(in, target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }
        log.info("[mixcut] asset uploaded id={} kind={} user={} size={} → {}",
                id, safeKind, safeUserId, file.getSize(), target.getAbsolutePath());

        // 视频/音频用 ffprobe 探测时长
        double duration = 0;
        if ("video".equals(safeKind) || "bgm".equals(safeKind)) {
            duration = ffmpeg.probeDurationSec(target);
        }

        MixcutAsset asset = new MixcutAsset();
        asset.setId(id);
        asset.setUserId(safeUserId);
        asset.setKind(safeKind);
        asset.setName((displayName != null && !displayName.isBlank())
                ? displayName.trim()
                : (file.getOriginalFilename() != null ? file.getOriginalFilename() : storedName));
        asset.setOriginalName(file.getOriginalFilename());
        asset.setMimeType(file.getContentType());
        asset.setFileSize(file.getSize());
        asset.setDuration(duration);
        asset.setTags(tags == null ? null : tags.trim());
        asset.setLocalPath(target.getAbsolutePath());
        asset.setFileUrl(props.getAssetPublicUrlBase() + "/" + safeUserId + "/" + storedName);
        asset.setUploadedAt(OffsetDateTime.now());

        return repo.save(asset);
    }

    @Transactional
    public boolean delete(String id) {
        Optional<MixcutAsset> opt = repo.findById(id);
        if (opt.isEmpty()) return false;
        MixcutAsset a = opt.get();
        if (a.getLocalPath() != null) {
            File f = new File(a.getLocalPath());
            if (f.exists() && !f.delete()) {
                log.warn("[mixcut] failed to delete asset file {} (continuing with DB delete)",
                        f.getAbsolutePath());
            }
        }
        repo.delete(a);
        log.info("[mixcut] asset deleted id={} kind={}", id, a.getKind());
        return true;
    }

    // ── 内部 ───────────────────────────────────────────────────────────────────

    private String validateKind(String kind) {
        if (kind == null || !KIND_VALUES.contains(kind)) {
            throw new IllegalArgumentException("kind 必须为 video / image / sticker / bgm 之一");
        }
        return kind;
    }

    private void validateMime(String kind, String mime) {
        if (mime == null) {
            throw new IllegalArgumentException("缺失 Content-Type");
        }
        boolean ok = switch (kind) {
            case "video" -> VIDEO_MIMES.contains(mime);
            case "image", "sticker" -> IMAGE_MIMES.contains(mime);
            case "bgm" -> AUDIO_MIMES.contains(mime);
            default -> false;
        };
        if (!ok) {
            throw new IllegalArgumentException("kind=" + kind + " 不接受 " + mime);
        }
    }

    private static String sanitize(String s) {
        return SAFE_NAME.matcher(s).replaceAll("_");
    }

    private static String guessExt(String original, String mime) {
        if (original != null) {
            int dot = original.lastIndexOf('.');
            if (dot >= 0 && dot < original.length() - 1) {
                String ext = original.substring(dot).toLowerCase(Locale.ROOT);
                if (ext.matches("\\.[a-z0-9]{1,6}")) return ext;
            }
        }
        if (mime == null) return ".bin";
        return switch (mime) {
            case "video/mp4" -> ".mp4";
            case "video/quicktime" -> ".mov";
            case "video/webm" -> ".webm";
            case "image/png" -> ".png";
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "audio/mpeg" -> ".mp3";
            case "audio/wav", "audio/x-wav" -> ".wav";
            case "audio/mp4", "audio/aac" -> ".m4a";
            case "audio/ogg" -> ".ogg";
            default -> ".bin";
        };
    }
}
