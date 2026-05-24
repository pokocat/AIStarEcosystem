package com.aistareco.aep.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 混剪渲染任务。一次提交对应一个 MixcutRenderJob，可产出 N 个 MixcutRenderOutput。
 */
@Entity
@Table(name = "mixcut_render_job", indexes = {
        @Index(name = "idx_mixcut_job_user", columnList = "userId"),
        @Index(name = "idx_mixcut_job_status", columnList = "status")
})
public class MixcutRenderJob {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64)
    private String userId;

    @Column(length = 128, nullable = false)
    private String templateId;

    @Column(length = 256)
    private String templateName;

    @Column(length = 512)
    private String templateThumbnail;

    /** slot_bindings 完整 JSON（Record<slot_id, SlotBinding>）。 */
    @Lob
    @Column(name = "slot_bindings_json", columnDefinition = "TEXT")
    private String slotBindingsJson;

    /** v0.10: 画布快照（{width,height,fps}），缺省回退 720x1280。 */
    @Column(name = "canvas_snapshot_json", columnDefinition = "TEXT")
    private String canvasSnapshotJson;

    /** v0.10: 槽位快照数组（[{slot_id, layer_type, rect, z_index, perturbation_policy}]）。 */
    @Lob
    @Column(name = "slots_snapshot_json", columnDefinition = "TEXT")
    private String slotsSnapshotJson;

    /**
     * v0.25+: 场景快照数组（[{id, label?, duration_sec, slot_ids[]}]，按场景顺序）。
     * 渲染器据此按场景串行拼接 ffmpeg concat 链 —— 每个场景 = 一个 segment，长度由
     * duration_sec 决定。slot_ids 让 overlay 知道自己归属哪个场景的时段。
     * 缺省 → 渲染器回退到 v0.24 行为（硬编 segCount=Math.min(2, sources.size())）。
     */
    @Lob
    @Column(name = "scenes_snapshot_json", columnDefinition = "TEXT")
    private String scenesSnapshotJson;

    /** v0.10: 任务级扰动总开关 {allow_mirror, allow_speed, allow_brightness, allow_saturation}。 */
    @Column(name = "perturbation_overrides_json", columnDefinition = "TEXT")
    private String perturbationOverridesJson;

    /**
     * v0.13+: 任务级扰动贴图池配置。结构（slot 级 Map）：
     *   {
     *     "<slotId>": { "pool_ids": ["preset_..."], "coverage": "intro"|"outro"|"loop"|"random_3s",
     *                   "opacity": 0.75, "scale_pct": 18, "pick_count": 1 },
     *     "_global": {...}    // 可选：不绑定具体 slot，整片随机位置
     *   }
     * 渲染器按 jobId+variantIndex 作为 seed 从 pool_ids 抽样，叠加 GIF overlay。
     */
    @Lob
    @Column(name = "sticker_pool_json", columnDefinition = "TEXT")
    private String stickerPoolJson;

    /** light / moderate / aggressive */
    @Column(length = 16, nullable = false)
    private String perturbationProfile;

    @Column(nullable = false)
    private int outputVariants;

    /** pending / queued / running / success / failed / partial */
    @Column(length = 16, nullable = false)
    private String status;

    @Column(nullable = false)
    private int progress;

    @Column(length = 1024)
    private String errorMessage;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime completedAt;

    /**
     * v0.x: 原片视觉指纹（aHash 64bit hex, 16 字符）。
     * 渲染开始时对第一段底层视频抽帧后算一次,后续每个变体的 phashDistanceToSource 都是
     * 与此值的汉明距离,而不再是伪随机数。
     */
    @Column(name = "source_phash", length = 16)
    private String sourcePhash;

    /**
     * v0.26+: 关联商品 id（Product.id），可空。
     * 当用户从商品库点「生成视频」进入 create 页（URL ?product_id=X）时携带，
     * 让后续分发（BatchPublishDrawer）能反查商品并自动填抖音商品挂载字段。
     */
    @Column(length = 64)
    private String productId;

    /**
     * v0.30+: 任务血缘 —— 由「重跑」入口从原 job fork 时填入原 jobId。
     * 默认 null（直接 create 出来的任务）；非空表示「这是基于 {forkedFromJobId} 的快照重跑出来的」。
     * 前端任务详情页据此显示「来自任务 #xxx」徽章；运营也能在 admin 追溯重跑链。
     * 不做外键约束（原 job 被物理删后不应级联，保留字符串引用足够审计）。
     */
    @Column(name = "forked_from_job_id", length = 64)
    private String forkedFromJobId;

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @OrderBy("variantIndex ASC")
    private List<MixcutRenderOutput> outputs = new ArrayList<>();

    // ── getters / setters ────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }

    public String getTemplateThumbnail() { return templateThumbnail; }
    public void setTemplateThumbnail(String templateThumbnail) { this.templateThumbnail = templateThumbnail; }

    public String getSlotBindingsJson() { return slotBindingsJson; }
    public void setSlotBindingsJson(String slotBindingsJson) { this.slotBindingsJson = slotBindingsJson; }

    public String getPerturbationProfile() { return perturbationProfile; }
    public void setPerturbationProfile(String perturbationProfile) { this.perturbationProfile = perturbationProfile; }

    public int getOutputVariants() { return outputVariants; }
    public void setOutputVariants(int outputVariants) { this.outputVariants = outputVariants; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }

    public List<MixcutRenderOutput> getOutputs() { return outputs; }
    public void setOutputs(List<MixcutRenderOutput> outputs) { this.outputs = outputs; }

    public String getCanvasSnapshotJson() { return canvasSnapshotJson; }
    public void setCanvasSnapshotJson(String canvasSnapshotJson) { this.canvasSnapshotJson = canvasSnapshotJson; }

    public String getSlotsSnapshotJson() { return slotsSnapshotJson; }
    public void setSlotsSnapshotJson(String slotsSnapshotJson) { this.slotsSnapshotJson = slotsSnapshotJson; }

    public String getScenesSnapshotJson() { return scenesSnapshotJson; }
    public void setScenesSnapshotJson(String scenesSnapshotJson) { this.scenesSnapshotJson = scenesSnapshotJson; }

    public String getPerturbationOverridesJson() { return perturbationOverridesJson; }
    public void setPerturbationOverridesJson(String perturbationOverridesJson) { this.perturbationOverridesJson = perturbationOverridesJson; }

    public String getSourcePhash() { return sourcePhash; }
    public void setSourcePhash(String sourcePhash) { this.sourcePhash = sourcePhash; }

    public String getStickerPoolJson() { return stickerPoolJson; }
    public void setStickerPoolJson(String stickerPoolJson) { this.stickerPoolJson = stickerPoolJson; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getForkedFromJobId() { return forkedFromJobId; }
    public void setForkedFromJobId(String forkedFromJobId) { this.forkedFromJobId = forkedFromJobId; }
}
