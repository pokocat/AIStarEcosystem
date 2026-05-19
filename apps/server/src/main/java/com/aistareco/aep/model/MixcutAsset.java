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
        @Index(name = "idx_mixcut_asset_preset_group", columnList = "isPreset,presetGroup")
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
}
