package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.AssetDto;
import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.repository.ClipAssetRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.common.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.time.Instant;
import java.util.*;

@Service
@Slf4j
public class ClipAssetService {
    private static final Set<String> KINDS = Set.of("video", "image", "bgm");
    private static final Set<String> VIDEO = Set.of("video/mp4", "video/quicktime", "video/x-m4v");
    private static final Set<String> IMAGE = Set.of("image/jpeg", "image/png", "image/heic", "image/heif");
    private static final Set<String> AUDIO = Set.of("audio/mpeg", "audio/mp4", "audio/aac", "audio/wav");
    private final ClipAssetRepository repo; private final FileStorageService storage; private final ClipProperties props; private final FfmpegRunner ffmpeg;
    private final ClipAssetThumbnailExtractor thumbnailExtractor; private final ClipTemplateService templates;
    public ClipAssetService(ClipAssetRepository repo, FileStorageService storage, ClipProperties props, FfmpegRunner ffmpeg,
                            ClipAssetThumbnailExtractor thumbnailExtractor, @org.springframework.context.annotation.Lazy ClipTemplateService templates) {
        this.repo = repo; this.storage = storage; this.props = props; this.ffmpeg = ffmpeg; this.thumbnailExtractor = thumbnailExtractor;
        this.templates = templates;
    }

    /** 素材库存储占用。端上用它显示容量条并在满了之前就提示。 */
    public ClipDtos.AssetStorageDto storage(String owner) {
        return new ClipDtos.AssetStorageDto(repo.sumBytesByOwner(owner), props.getMaxOwnerAssetBytes(),
                repo.countByExternalOwnerIdAndDeletedAtIsNull(owner));
    }

    public List<AssetDto> list(String owner) {
        List<ClipAsset> rows = new ArrayList<>(repo.findByExternalOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner));
        rows.addAll(repo.findByPresetTrueAndDeletedAtIsNullOrderByCreatedAtDesc()); return rows.stream().map(this::dto).toList();
    }
    @Transactional public AssetDto upload(String owner, MultipartFile file, String kind, String label, boolean preset, String presetGroup) {
        return upload(owner, file, kind, label, preset, presetGroup, null, null);
    }
    /**
     * @param clientWidth  端上 {@code wx.chooseMedia} 报的像素宽，**仅作探测失败时的兜底**
     * @param clientHeight 同上；两者必须同时为正才采信，任一缺失即整体丢弃（半个尺寸没有意义）
     */
    @Transactional public AssetDto upload(String owner, MultipartFile file, String kind, String label, boolean preset, String presetGroup,
                                          Integer clientWidth, Integer clientHeight) {
        String normalized = kind == null ? "video" : kind.trim().toLowerCase(Locale.ROOT);
        if (!KINDS.contains(normalized)) throw BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "素材类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_ASSET_REQUIRED", "未收到素材");
        if (file.getSize() > props.getMaxAssetBytes() || !mimeAllowed(normalized, file.getContentType())) throw BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "素材格式或大小不合规");
        // 总容量闸：单文件合规不代表还装得下。放在落盘之前，避免先写文件再回滚。
        // 预置素材是平台提供的，不占用户配额。
        if (!preset) {
            long used = repo.sumBytesByOwner(owner);
            if (used + file.getSize() > props.getMaxOwnerAssetBytes()) {
                throw BusinessException.badRequest("CLIP_ASSET_QUOTA_EXCEEDED",
                        "素材库空间不够了，删掉一些不用的素材再上传");
            }
        }
        FileStorageService.StoredFile stored = storage.store(file, "clip/assets", preset ? "preset" : owner);
        // 时长与宽高共用一次 ffprobe：probeMedia 的 duration 与 probeDurationSec 同源（format.duration），
        // 但它还顺带给出视频流的 width/height，所以没有理由为同一个文件起两次子进程。
        // 图片同样能被 ffprobe 读出宽高（走 video stream），所以这里不再按 kind 跳过。
        FfmpegRunner.MediaProbe probe = null;
        try { probe = ffmpeg.probeMedia(storage.openForRead(stored.key()).toFile()); }
        catch (Exception ignored) { /* 元数据是增强；格式/MIME 与真实读取已在前面完成校验。 */ }
        double duration = 0;
        if ("video".equals(normalized) || "bgm".equals(normalized)) {
            duration = probe == null ? 0 : Math.max(0, probe.durationSec());
        }
        // 宽高优先信服务端探测（端上值不可信，且图片在 wx.chooseMedia 里本就不保证有 width/height）；
        // 探测不出来才退到端上报的值。两条都拿不到就保持 null —— 不许落 0。
        Integer width = positiveOrNull(probe == null ? 0 : probe.width());
        Integer height = positiveOrNull(probe == null ? 0 : probe.height());
        if (width == null || height == null) {
            width = positiveOrNull(clientWidth == null ? 0 : clientWidth);
            height = positiveOrNull(clientHeight == null ? 0 : clientHeight);
            if (width == null || height == null) { width = null; height = null; }
        }
        FileStorageService.StoredFile thumbnail = null;
        if ("video".equals(normalized)) {
            try { thumbnail = thumbnailExtractor.extract(preset ? "preset" : owner, stored.key()); }
            catch (Exception error) { log.warn("[clip-asset] thumbnail skipped owner={}: {}", owner, error.getMessage()); }
        }
        ClipAsset a = ClipAsset.builder().id("ca_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .externalOwnerId(preset ? null : owner).kind(normalized).label(displayLabel(normalized, cleanLabel(label, file.getOriginalFilename())))
                .tag(cleanLabel(label, "待整理")).localPath(stored.localPath()).cdnKey(stored.key()).mimeType(stored.contentType())
                .thumbnailCdnKey(thumbnail == null ? null : thumbnail.key())
                .bytes(stored.bytes()).durationSec(duration).width(width).height(height)
                .preset(preset).presetGroup(presetGroup).createdAt(Instant.now()).build();
        return dto(repo.save(a));
    }
    /** 只有正整数才是真尺寸；0/负数/null 一律回 null（"没测到"不得伪装成 0 像素）。 */
    private static Integer positiveOrNull(int value) { return value > 0 ? Integer.valueOf(value) : null; }
    @Transactional public AssetDto ensureBundledPreset(String id, String label, String group, byte[] video) {
        ClipAsset existing = repo.findById(id).filter(a -> a.getDeletedAt() == null).orElse(null);
        if (existing != null) return dto(existing);
        FileStorageService.StoredFile stored = storage.store(video, "clip/assets", "preset", "mp4", "video/mp4");
        // 同 upload()：一次 probeMedia 同时拿时长与宽高，官方尾段也要有分辨率，否则素材库里它是唯一一条"未知"。
        FfmpegRunner.MediaProbe probe = null;
        try { probe = ffmpeg.probeMedia(storage.openForRead(stored.key()).toFile()); } catch (Exception ignored) {}
        double duration = probe == null ? 0 : Math.max(0, probe.durationSec());
        FileStorageService.StoredFile thumbnail = null;
        try { thumbnail = thumbnailExtractor.extract("preset", stored.key()); } catch (Exception error) { log.warn("[clip-asset] bundled thumbnail skipped id={}: {}", id, error.getMessage()); }
        ClipAsset asset = ClipAsset.builder().id(id).externalOwnerId(null).kind("video").label(label).tag("固定片段")
                .localPath(stored.localPath()).cdnKey(stored.key()).mimeType("video/mp4")
                .thumbnailCdnKey(thumbnail == null ? null : thumbnail.key()).bytes(stored.bytes()).durationSec(duration)
                .width(positiveOrNull(probe == null ? 0 : probe.width())).height(positiveOrNull(probe == null ? 0 : probe.height()))
                .preset(true).presetGroup(group).createdAt(Instant.now()).build();
        return dto(repo.save(asset));
    }
    @Transactional public AssetDto update(String owner, String id, String label, String tag) {
        ClipAsset a = required(owner, id); if (a.isPreset()) throw BusinessException.badRequest("CLIP_ASSET_NOT_OWNED", "预置素材不能修改");
        if (label != null && !label.isBlank()) a.setLabel(cleanLabel(label, a.getLabel())); if (tag != null && !tag.isBlank()) a.setTag(cleanLabel(tag, a.getTag())); return dto(repo.save(a));
    }
    /**
     * 删除一条**预置**素材（运营侧动作）。
     *
     * 与用户删自有素材是两回事：预置素材不属于任何人，混排在每个人的素材库里，用户删不掉。
     * 停用一个模板后它的片尾就成了谁也用不到、谁也删不掉的残留，只能由运营从这里清掉。
     * 调用方必须先确认没有在用的模板依赖它 —— 这里会连带把引用清空，但清空不等于「不影响出片」。
     */
    @Transactional public void deletePreset(String id) {
        ClipAsset a = repo.findById(id).filter(row -> row.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("CLIP_ASSET_NOT_FOUND", "素材不存在"));
        if (!a.isPreset()) throw BusinessException.badRequest("CLIP_ASSET_NOT_PRESET", "这不是预置素材，请让素材所有者自己删除");
        templates.detachTailClip(id);
        storage.delete(a.getCdnKey()); storage.delete(a.getThumbnailCdnKey()); repo.delete(a);
    }

    @Transactional public void delete(String owner, String id) { ClipAsset a = required(owner, id); storage.delete(a.getCdnKey()); storage.delete(a.getThumbnailCdnKey()); repo.delete(a); }

    /**
     * 取一条**属于本人且可改动**的素材。
     *
     * ★ 预置素材必须单独判。list() 会把 preset 素材和自有素材混在一起返回（端上是一个库），
     *   但它们的 externalOwnerId 不是当前用户 —— 原实现直接按 owner 查，于是删预置素材时
     *   抛的是「素材不存在或无权访问」。delete() 里那句「预置素材不能删除」永远走不到，
     *   用户看到的是一句听起来像 bug 或权限故障的话，而真实原因只是「这条本来就删不得」。
     *   （2026-08-14 真机实测复现。）
     */
    private ClipAsset required(String owner, String id) {
        ClipAsset a = repo.findById(id).filter(row -> row.getDeletedAt() == null)
                .orElseThrow(() -> BusinessException.notFound("CLIP_ASSET_NOT_FOUND", "素材不存在或无权访问"));
        if (a.isPreset()) throw BusinessException.badRequest("CLIP_ASSET_PRESET_READONLY", "这是内置素材，不能改名也不能删除");
        if (!owner.equals(a.getExternalOwnerId())) throw BusinessException.notFound("CLIP_ASSET_NOT_FOUND", "素材不存在或无权访问");
        return a;
    }
    public ClipAsset requiredVisible(String owner, String id) {
        return repo.findById(id).filter(a -> a.getDeletedAt() == null && (a.isPreset() || owner.equals(a.getExternalOwnerId())))
                .orElseThrow(() -> BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "配画面素材不存在或无权使用"));
    }
    public AssetDto visible(String owner, String id) { return dto(requiredVisible(owner, id)); }
    private AssetDto dto(ClipAsset a) {
        if ("video".equals(a.getKind()) && a.getThumbnailCdnKey() == null && a.getCdnKey() != null) {
            try {
                FileStorageService.StoredFile thumbnail = thumbnailExtractor.extract(a.isPreset() ? "preset" : a.getExternalOwnerId(), a.getCdnKey());
                a.setThumbnailCdnKey(thumbnail.key()); repo.save(a);
            } catch (Exception error) {
                log.warn("[clip-asset] thumbnail backfill skipped asset={}: {}", a.getId(), error.getMessage());
            }
        }
        String previewKey = "image".equals(a.getKind()) ? a.getCdnKey() : a.getThumbnailCdnKey();
        String previewUrl = previewKey == null ? null : storage.signedUrl(previewKey);
        String contentUrl = a.getCdnKey() == null ? null : storage.signedUrl(a.getCdnKey());
        return AssetDto.from(a, previewUrl, contentUrl, displayLabel(a.getKind(), a.getLabel()));
    }
    private static boolean mimeAllowed(String kind, String mime) { return "video".equals(kind) ? VIDEO.contains(mime) : "image".equals(kind) ? IMAGE.contains(mime) : AUDIO.contains(mime); }
    private static String cleanLabel(String value, String fallback) { String s = value == null || value.isBlank() ? fallback : value.trim(); if (s == null || s.isBlank()) s = "未命名素材"; return s.substring(0, Math.min(128, s.length())); }
    static String displayLabel(String kind, String value) {
        String label = value == null ? "" : value.trim();
        String lower = label.toLowerCase(Locale.ROOT);
        boolean temporary = label.isBlank() || lower.startsWith("tmp_") || lower.startsWith("wxfile:")
                || lower.contains("/tmp/") || label.length() > 52 || lower.matches("[0-9a-f_-]{24,}(\\.[a-z0-9]+)?");
        if (temporary) return "image".equals(kind) ? "我的图片素材" : "我的视频素材";
        return label;
    }
}
