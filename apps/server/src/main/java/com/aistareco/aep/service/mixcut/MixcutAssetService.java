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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 用户上传素材的 CRUD + 落 fs。
 *
 *  - upload(file, kind, userId, name)：保存到 ./mixcut-assets/<userId>/<id><ext>，写 DB
 *  - uploadPreset(file, kind, group, name)：admin / DataInitializer 路径，标 is_preset=true，ownerUserId=null
 *  - listVisibleTo / getVisibleTo / deleteOwned：v0.13+ 安全前置后的对外 API
 *
 *  v0.13.0+ 安全模型：
 *   - 普通用户上传 → ownerUserId=自己；列表只看到自己 + preset
 *   - preset 素材 ownerUserId=null，is_preset=true，全用户可见，**不可被普通用户删除**
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

    // ─── v0.13.0+ 安全感知列表 ─────────────────────────────────────────────────────

    /**
     * 列出当前用户可见的素材：自己上传的 + 所有 preset。
     *
     * @param userId         当前 principal 用户 id（必传；null/blank 时仅返回 preset）
     * @param kind           可选过滤（video/image/sticker/bgm）
     * @param presetOnly     true=仅返回 preset 池；false/null=返回 user-owned + preset
     * @param presetGroup    可选 preset 分组过滤（仅在 presetOnly=true 或 kind=sticker 时生效）
     */
    public List<MixcutAsset> listVisibleTo(String userId, String kind, Boolean presetOnly, String presetGroup) {
        boolean hasUser = userId != null && !userId.isBlank();
        boolean hasKind = kind != null && !kind.isBlank();
        boolean hasGroup = presetGroup != null && !presetGroup.isBlank();
        boolean onlyPreset = Boolean.TRUE.equals(presetOnly);

        List<MixcutAsset> presets;
        if (hasKind && hasGroup) {
            presets = repo.findByIsPresetTrueAndKindAndPresetGroupOrderByNameAsc(kind, presetGroup);
        } else if (hasKind) {
            presets = repo.findByIsPresetTrueAndKindOrderByPresetGroupAscNameAsc(kind);
        } else if (hasGroup) {
            presets = repo.findByIsPresetTrueAndPresetGroupOrderByNameAsc(presetGroup);
        } else {
            presets = repo.findByIsPresetTrueOrderByPresetGroupAscNameAsc();
        }

        if (onlyPreset || !hasUser) {
            return presets;
        }

        List<MixcutAsset> ownByUser = hasKind
                ? repo.findByUserIdAndKindOrderByUploadedAtDesc(userId, kind)
                : repo.findByUserIdOrderByUploadedAtDesc(userId);

        // user 私有的先 + preset 后（用户更可能想看自己刚传的）
        Map<String, MixcutAsset> merged = new LinkedHashMap<>();
        for (MixcutAsset a : ownByUser) merged.put(a.getId(), a);
        for (MixcutAsset a : presets) merged.putIfAbsent(a.getId(), a);
        return new ArrayList<>(merged.values());
    }

    /** 当前用户可见 = 自己拥有 OR 是 preset。否则 empty。 */
    public Optional<MixcutAsset> getVisibleTo(String id, String userId) {
        return repo.findById(id).filter(a -> {
            if (a.isPreset()) return true;
            return userId != null && !userId.isBlank() && userId.equals(a.getUserId());
        });
    }

    /** 仅当资产属于 userId 时删除。preset 直接拒绝（用户端不可删 preset；admin 走 /api/admin/mixcut/preset-stickers）。 */
    @Transactional
    public boolean deleteOwned(String id, String userId) {
        if (userId == null || userId.isBlank()) return false;
        Optional<MixcutAsset> opt = repo.findById(id);
        if (opt.isEmpty()) return false;
        MixcutAsset a = opt.get();
        if (a.isPreset()) return false;
        if (!userId.equals(a.getUserId())) return false;
        return deleteInternal(a);
    }

    /** Admin / DataInitializer：删除指定 preset（不校验 ownerUserId）。 */
    @Transactional
    public boolean deletePreset(String id) {
        Optional<MixcutAsset> opt = repo.findById(id);
        if (opt.isEmpty()) return false;
        MixcutAsset a = opt.get();
        if (!a.isPreset()) return false;
        return deleteInternal(a);
    }

    private boolean deleteInternal(MixcutAsset a) {
        if (a.getLocalPath() != null) {
            File f = new File(a.getLocalPath());
            if (f.exists() && !f.delete()) {
                log.warn("[mixcut] failed to delete asset file {} (continuing with DB delete)",
                        f.getAbsolutePath());
            }
        }
        if (a.getPreviewUrl() != null && a.getPreviewUrl().startsWith(props.getAssetPublicUrlBase())) {
            String rel = a.getPreviewUrl().substring(props.getAssetPublicUrlBase().length());
            File pf = new File(props.getAssetDir(), rel);
            if (pf.exists()) pf.delete();
        }
        repo.delete(a);
        log.info("[mixcut] asset deleted id={} kind={} preset={}", a.getId(), a.getKind(), a.isPreset());
        return true;
    }

    // ── 兼容性：旧 list API（无 principal 校验，仅 admin / 内部使用）─────────────

    public List<MixcutAsset> listAll(String kind, String userId) {
        if (kind != null && !kind.isBlank() && userId != null && !userId.isBlank()) {
            return repo.findByUserIdAndKindOrderByUploadedAtDesc(userId, kind);
        }
        if (kind != null && !kind.isBlank()) return repo.findByKindOrderByUploadedAtDesc(kind);
        if (userId != null && !userId.isBlank()) return repo.findByUserIdOrderByUploadedAtDesc(userId);
        return repo.findAllByOrderByUploadedAtDesc();
    }

    /** 内部用：从 jobId binding 解析 asset_id 时使用。无 ownership 校验（worker 已是受信路径）。 */
    public Optional<MixcutAsset> get(String id) {
        return repo.findById(id);
    }

    /**
     * 上传单个素材（用户路径）。
     *
     * @param file        MultipartFile（必填）
     * @param kind        video / image / sticker / bgm（必填）
     * @param userId      上传者 ID（必填；controller 已从 principal 取）
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
        asset.setPreset(false);
        asset.setPresetGroup(null);

        return repo.save(asset);
    }

    /**
     * 上传预置素材（admin / DataInitializer 路径）。
     * - ownerUserId 固定 null
     * - isPreset = true
     * - presetGroup 必填（用于 UI 分组展示）
     * - 文件落 ./mixcut-assets/preset/<group>/<storedName>
     * - GIF / image 自动用 ffmpeg 抽第一帧落 preview_url
     */
    @Transactional
    public MixcutAsset uploadPreset(MultipartFile file, String kind, String presetGroup,
                                    String displayName, String tags) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("文件不能为空");
        }
        if (presetGroup == null || presetGroup.isBlank()) {
            throw new IllegalArgumentException("preset_group 必填");
        }
        String safeKind = validateKind(kind);
        validateMime(safeKind, file.getContentType());
        if (file.getSize() > props.getMaxAssetBytes()) {
            throw new IllegalArgumentException("文件超过最大限制 " + props.getMaxAssetBytes() + " 字节");
        }
        String safeGroup = sanitize(presetGroup).toLowerCase(Locale.ROOT);
        String id = "preset_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String ext = guessExt(file.getOriginalFilename(), file.getContentType());
        String storedName = id + ext;

        File groupDir = new File(new File(props.getAssetDir(), "preset"), safeGroup);
        if (!groupDir.exists() && !groupDir.mkdirs()) {
            throw new IOException("Cannot create preset dir: " + groupDir.getAbsolutePath());
        }
        File target = new File(groupDir, storedName);
        try (var in = file.getInputStream()) {
            Files.copy(in, target.toPath(), StandardCopyOption.REPLACE_EXISTING);
        }

        String publicUrl = props.getAssetPublicUrlBase() + "/preset/" + safeGroup + "/" + storedName;
        String previewUrl = generatePreview(target, groupDir, id, safeGroup);

        MixcutAsset asset = new MixcutAsset();
        asset.setId(id);
        asset.setUserId(null);
        asset.setKind(safeKind);
        asset.setName((displayName != null && !displayName.isBlank())
                ? displayName.trim()
                : (file.getOriginalFilename() != null ? file.getOriginalFilename() : storedName));
        asset.setOriginalName(file.getOriginalFilename());
        asset.setMimeType(file.getContentType());
        asset.setFileSize(file.getSize());
        asset.setDuration(0);
        asset.setTags(tags == null ? null : tags.trim());
        asset.setLocalPath(target.getAbsolutePath());
        asset.setFileUrl(publicUrl);
        asset.setPreviewUrl(previewUrl);
        asset.setUploadedAt(OffsetDateTime.now());
        asset.setPreset(true);
        asset.setPresetGroup(safeGroup);

        log.info("[mixcut] preset uploaded id={} group={} kind={} → {}",
                id, safeGroup, safeKind, target.getAbsolutePath());
        return repo.save(asset);
    }

    /** 内部：注册一条 preset 行（DataInitializer 路径，文件已落在 fs 上）。 */
    @Transactional
    public MixcutAsset registerPresetRow(String id, String kind, String presetGroup, String name,
                                         File localFile, String publicUrl, String previewUrl) {
        MixcutAsset asset = new MixcutAsset();
        asset.setId(id);
        asset.setUserId(null);
        asset.setKind(validateKind(kind));
        asset.setName(name);
        asset.setOriginalName(name);
        asset.setMimeType(kind.equals("sticker") || kind.equals("image") ? "image/gif" : null);
        asset.setFileSize(localFile.length());
        asset.setDuration(0);
        asset.setTags(null);
        asset.setLocalPath(localFile.getAbsolutePath());
        asset.setFileUrl(publicUrl);
        asset.setPreviewUrl(previewUrl);
        asset.setUploadedAt(OffsetDateTime.now());
        asset.setPreset(true);
        asset.setPresetGroup(presetGroup);
        return repo.save(asset);
    }

    /** GIF / image 抽第一帧落 preview jpg；失败返回 null。 */
    private String generatePreview(File source, File groupDir, String id, String group) {
        File preview = new File(groupDir, id + "_preview.jpg");
        try {
            ffmpeg.runFfmpeg(List.of(
                    "-y",
                    "-i", source.getAbsolutePath(),
                    "-frames:v", "1",
                    "-update", "1",
                    "-vf", "scale=200:-2",
                    "-q:v", "5",
                    preview.getAbsolutePath()
            ));
            if (preview.exists() && preview.length() > 0) {
                return props.getAssetPublicUrlBase() + "/preset/" + group + "/" + preview.getName();
            }
        } catch (Exception e) {
            log.warn("[mixcut] preset preview generation failed id={} err={}", id, e.getMessage());
        }
        return null;
    }

    @Transactional
    public boolean delete(String id) {
        Optional<MixcutAsset> opt = repo.findById(id);
        if (opt.isEmpty()) return false;
        return deleteInternal(opt.get());
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
