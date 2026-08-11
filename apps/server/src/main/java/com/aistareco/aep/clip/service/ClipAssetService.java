package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
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
    private final ClipAssetThumbnailExtractor thumbnailExtractor;
    public ClipAssetService(ClipAssetRepository repo, FileStorageService storage, ClipProperties props, FfmpegRunner ffmpeg,
                            ClipAssetThumbnailExtractor thumbnailExtractor) {
        this.repo = repo; this.storage = storage; this.props = props; this.ffmpeg = ffmpeg; this.thumbnailExtractor = thumbnailExtractor;
    }

    public List<AssetDto> list(String owner) {
        List<ClipAsset> rows = new ArrayList<>(repo.findByExternalOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(owner));
        rows.addAll(repo.findByPresetTrueAndDeletedAtIsNullOrderByCreatedAtDesc()); return rows.stream().map(this::dto).toList();
    }
    @Transactional public AssetDto upload(String owner, MultipartFile file, String kind, String label, boolean preset, String presetGroup) {
        String normalized = kind == null ? "video" : kind.trim().toLowerCase(Locale.ROOT);
        if (!KINDS.contains(normalized)) throw BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "素材类型不支持");
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("CLIP_ASSET_REQUIRED", "未收到素材");
        if (file.getSize() > props.getMaxAssetBytes() || !mimeAllowed(normalized, file.getContentType())) throw BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "素材格式或大小不合规");
        FileStorageService.StoredFile stored = storage.store(file, "clip/assets", preset ? "preset" : owner);
        double duration = 0;
        if ("video".equals(normalized) || "bgm".equals(normalized)) {
            try { duration = Math.max(0, ffmpeg.probeDurationSec(storage.openForRead(stored.key()).toFile())); }
            catch (Exception ignored) { /* 预览时长是增强；格式/MIME 与真实读取已在前面完成校验。 */ }
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
                .bytes(stored.bytes()).durationSec(duration).preset(preset).presetGroup(presetGroup).createdAt(Instant.now()).build();
        return dto(repo.save(a));
    }
    @Transactional public AssetDto update(String owner, String id, String label, String tag) {
        ClipAsset a = required(owner, id); if (a.isPreset()) throw BusinessException.badRequest("CLIP_ASSET_NOT_OWNED", "预置素材不能修改");
        if (label != null && !label.isBlank()) a.setLabel(cleanLabel(label, a.getLabel())); if (tag != null && !tag.isBlank()) a.setTag(cleanLabel(tag, a.getTag())); return dto(repo.save(a));
    }
    @Transactional public void delete(String owner, String id) { ClipAsset a = required(owner, id); if (a.isPreset()) throw BusinessException.badRequest("CLIP_ASSET_NOT_OWNED", "预置素材不能删除"); storage.delete(a.getCdnKey()); storage.delete(a.getThumbnailCdnKey()); repo.delete(a); }
    private ClipAsset required(String owner, String id) { return repo.findByIdAndExternalOwnerIdAndDeletedAtIsNull(id, owner).orElseThrow(() -> BusinessException.notFound("CLIP_ASSET_NOT_FOUND", "素材不存在或无权访问")); }
    public ClipAsset requiredVisible(String owner, String id) {
        return repo.findById(id).filter(a -> a.getDeletedAt() == null && (a.isPreset() || owner.equals(a.getExternalOwnerId())))
                .orElseThrow(() -> BusinessException.badRequest("CLIP_ASSET_NOT_ALLOWED", "配画面素材不存在或无权使用"));
    }
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
