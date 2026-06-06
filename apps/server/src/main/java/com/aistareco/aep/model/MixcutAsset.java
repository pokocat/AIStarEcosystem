package com.aistareco.aep.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 用户上传的混剪素材：视频 / 图片 / 贴图 / BGM。
 * 与 MixcutRenderJob 解耦 —— 一个素材可被多个 job 引用。
 */
@Entity
@Table(name = "mixcut_asset", indexes = {
        @Index(name = "idx_mixcut_asset_user_kind", columnList = "userId,kind"),
        @Index(name = "idx_mixcut_asset_kind", columnList = "kind"),
        @Index(name = "idx_mixcut_asset_preset_group", columnList = "isPreset,presetGroup"),
        @Index(name = "idx_mixcut_asset_deleted_at", columnList = "deleted_at")
})
public class MixcutAsset {

    @Id
    @Column(length = 64)
    private String id;

    /** 上传者用户 id；预置贴图为 null。 */
    @Column(length = 64)
    private String userId;

    /** video / image / sticker / bgm */
    @Column(length = 16, nullable = false)
    private String kind;

    @Column(length = 256, nullable = false)
    private String name;

    /** 公网/相对 URL，如 /static/mixcut-assets/<userId>/<filename>。前端可直接 src 用。 */
    @Column(length = 512, nullable = false)
    private String fileUrl;

    /** 服务器本地绝对路径（worker 用，不暴露给前端）。 */
    @Column(length = 1024)
    private String localPath;

    /**
     * v0.49+: OSS object key（经统一 FileStorageService 上传得到）。
     * 出 wire 时由 CdnUrlSigner 签名成 cdn_url（CDN/OSS 提供，省 ECS 带宽 + 防盗刷）。
     * 渲染仍读 localPath；本字段只为「素材库展示走 CDN」+ 后续本地清理（key 是真值）。
     * 老素材 / 上传 OSS 失败时为 null，前端回退 file_url。
     */
    @Column(name = "cdn_key", length = 512)
    private String cdnKey;

    /** 原始文件名（用于展示）。 */
    @Column(length = 256)
    private String originalName;

    @Column(length = 128)
    private String mimeType;

    private long fileSize;

    /** 视频/音频时长（秒），图片为 0。 */
    private double duration;

    /** 标签（逗号分隔），可选。 */
    @Column(length = 512)
    private String tags;

    @Column(nullable = false)
    private OffsetDateTime uploadedAt;

    /** v0.13+: 是否为平台预置素材（全用户可见，无 ownerUserId）。 */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean isPreset = false;

    /** v0.13+: 预置素材分组（如 sparkle / ribbon / emoji_burst），非预置为 null。 */
    @Column(length = 32)
    private String presetGroup;

    /** v0.13+: 预览缩略图 URL（GIF 抽第一帧）。仅预置贴图必填，用户上传可空。 */
    @Column(length = 512)
    private String previewUrl;

    /**
     * v0.21+: 是否为「官方明星片段」。
     * 由运营后台 (admin) 上传，平台所有用户可见消费但不可删 / 改。kind 通常为 video。
     * 与 isPreset（v0.13 贴图池）是两套互斥的「平台公共素材」：
     *   isPreset=true  → 扰动贴图池（GIF overlay）
     *   isOfficial=true → 官方明星视频片段（用户做混剪时的可选素材源）
     */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean isOfficial = false;

    /** v0.21+: 官方片段分类，例如「直播切片」「综艺」「访谈」「短视频」等。 */
    @Column(length = 32)
    private String officialCategory;

    /** v0.21+: 关联的明星 id（CelebrityStar.id）；可空（混合 / 不绑定明星）。 */
    @Column(length = 64)
    private String relatedStarId;

    /**
     * v0.26+: 关联商品 id（Product.id）；可空。
     * 商品链接解析时落的图片素材（subkind=product-photo）会带此字段；
     * create 页 `?product_id=X` 进入时按此字段筛出「本商品素材」。
     */
    @Column(length = 64)
    private String relatedProductId;

    /**
     * v0.26+: 素材子类（可空），用于区分同一 kind 下的不同来源：
     *   "user-upload"            — 用户手动上传
     *   "product-photo"          — 从商品链接解析落的图片（外网 CDN 直登记）
     *   "product-video"          — 商品相关视频
     *   "ai-marketing-video"     — AI 生成的带货视频（future）
     */
    @Column(length = 32)
    private String subkind;

    /**
     * v0.51+: 软删标记。官方明星片段删除只置该字段，文件和行保留供恢复 / 审计；
     * 对外列表默认过滤 deletedAt IS NULL。
     */
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ── getters / setters ─────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getCdnKey() { return cdnKey; }
    public void setCdnKey(String cdnKey) { this.cdnKey = cdnKey; }

    public String getLocalPath() { return localPath; }
    public void setLocalPath(String localPath) { this.localPath = localPath; }

    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }

    public double getDuration() { return duration; }
    public void setDuration(double duration) { this.duration = duration; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public OffsetDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(OffsetDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public boolean isPreset() { return isPreset; }
    public void setPreset(boolean preset) { isPreset = preset; }

    public String getPresetGroup() { return presetGroup; }
    public void setPresetGroup(String presetGroup) { this.presetGroup = presetGroup; }

    public String getPreviewUrl() { return previewUrl; }
    public void setPreviewUrl(String previewUrl) { this.previewUrl = previewUrl; }

    public boolean isOfficial() { return isOfficial; }
    public void setOfficial(boolean official) { isOfficial = official; }

    public String getOfficialCategory() { return officialCategory; }
    public void setOfficialCategory(String officialCategory) { this.officialCategory = officialCategory; }

    public String getRelatedStarId() { return relatedStarId; }
    public void setRelatedStarId(String relatedStarId) { this.relatedStarId = relatedStarId; }

    public String getRelatedProductId() { return relatedProductId; }
    public void setRelatedProductId(String relatedProductId) { this.relatedProductId = relatedProductId; }

    public String getSubkind() { return subkind; }
    public void setSubkind(String subkind) { this.subkind = subkind; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
