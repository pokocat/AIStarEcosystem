package com.aistareco.aep.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mixcut_render_output", indexes = {
        @Index(name = "idx_mixcut_output_job", columnList = "job_id")
})
public class MixcutRenderOutput {

    @Id
    @Column(length = 64)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private MixcutRenderJob job;

    @Column(nullable = false)
    private int variantIndex;

    @Column(length = 512)
    private String fileUrl;

    @Column(length = 512)
    private String thumbnailUrl;

    private long fileSize;

    private double duration;

    /** 简化版 phash（实际未真做 phash，只用一个 sha256 前缀代替 — MVP）。 */
    @Column(length = 64)
    private String phashSignature;

    private int phashDistanceToSource;

    /** 应用的扰动参数 JSON：mirror / speed / brightness / saturation / crop / slot_jitter */
    @Lob
    @Column(name = "applied_transforms_json", columnDefinition = "TEXT")
    private String appliedTransformsJson;

    @Column(length = 64)
    private String watermarkToken;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    /** v0.14+: CDN 公开 URL（如 /cdn/mixcut/<jobId>/v<N>.mp4）。本地 fake-CDN 或 OSS。 */
    @Column(length = 512)
    private String cdnUrl;

    /** v0.14+: CDN object key（用于 delete / 重命名）。 */
    @Column(length = 256)
    private String cdnKey;

    /** v0.14+: CDN 缩略图 URL（与 cdnUrl 一致结构，jpg 后缀）。 */
    @Column(length = 512)
    private String cdnThumbnailUrl;

    /** v0.14+: 上传到 CDN 完成的时间。 */
    private OffsetDateTime cdnUploadedAt;

    /**
     * v0.19+: 该变体被派发的累计次数（每个 output × target = +1）。
     * 视频库不再隐藏已发布变体；UI 用此字段展示「已发 ×N」徽标，允许再次分发。
     * 现存行通过 @ColumnDefault("0") 自动落 0。
     */
    @Column(nullable = false)
    @ColumnDefault("0")
    private int publishCount;

    /** v0.19+: 最近一次成功派发的时间；从未派发则为 null。 */
    private OffsetDateTime lastPublishedAt;

    /**
     * v0.21+: 软删时间。用户在视频库点删除后置非空；30 天后由清理调度器
     * 物理删除（删本地文件 + CDN + DB 行）。所有列表 / dto 查询默认过滤 deletedAt IS NULL。
     */
    private OffsetDateTime deletedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public MixcutRenderJob getJob() { return job; }
    public void setJob(MixcutRenderJob job) { this.job = job; }

    public int getVariantIndex() { return variantIndex; }
    public void setVariantIndex(int variantIndex) { this.variantIndex = variantIndex; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }

    public double getDuration() { return duration; }
    public void setDuration(double duration) { this.duration = duration; }

    public String getPhashSignature() { return phashSignature; }
    public void setPhashSignature(String phashSignature) { this.phashSignature = phashSignature; }

    public int getPhashDistanceToSource() { return phashDistanceToSource; }
    public void setPhashDistanceToSource(int phashDistanceToSource) { this.phashDistanceToSource = phashDistanceToSource; }

    public String getAppliedTransformsJson() { return appliedTransformsJson; }
    public void setAppliedTransformsJson(String appliedTransformsJson) { this.appliedTransformsJson = appliedTransformsJson; }

    public String getWatermarkToken() { return watermarkToken; }
    public void setWatermarkToken(String watermarkToken) { this.watermarkToken = watermarkToken; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public String getCdnUrl() { return cdnUrl; }
    public void setCdnUrl(String cdnUrl) { this.cdnUrl = cdnUrl; }

    public String getCdnKey() { return cdnKey; }
    public void setCdnKey(String cdnKey) { this.cdnKey = cdnKey; }

    public String getCdnThumbnailUrl() { return cdnThumbnailUrl; }
    public void setCdnThumbnailUrl(String cdnThumbnailUrl) { this.cdnThumbnailUrl = cdnThumbnailUrl; }

    public OffsetDateTime getCdnUploadedAt() { return cdnUploadedAt; }
    public void setCdnUploadedAt(OffsetDateTime cdnUploadedAt) { this.cdnUploadedAt = cdnUploadedAt; }

    public int getPublishCount() { return publishCount; }
    public void setPublishCount(int publishCount) { this.publishCount = publishCount; }

    public OffsetDateTime getLastPublishedAt() { return lastPublishedAt; }
    public void setLastPublishedAt(OffsetDateTime lastPublishedAt) { this.lastPublishedAt = lastPublishedAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
