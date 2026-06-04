package com.aistareco.aep.model;

import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 混剪「实例 / 草稿」（v0.48+）—— 模版与生成任务之间的中间层。
 *
 * <p>背景：以前 create 页（{@code /mixcut/create/[id]}）把整套填充态只存在 React state 里，
 * 用户切去编辑模版 / 刷新 / 关页就全丢；想反复用同一份配置生成也没有落点。本实体把
 * 「针对某模版配好的一份素材绑定 + 扰动设置」持久化下来，形成
 * <b>模版（MixcutTemplate） → 实例（MixcutDraft） → 生成任务（MixcutRenderJob）</b> 三层关系。
 *
 * <p>字段集刻意与 {@link MixcutRenderJob} 的快照列对齐 —— 一个实例本质上就是「一个还没提交渲染
 * 的任务配置」。生成任务时把这些快照原样灌进 MixcutRenderJob，并在 job 上记 {@code draftId}
 * 指回本实例，实现「生成任务回溯到当时配置的实例」。
 *
 * <p>归属：{@code userId} 严格隔离（与 job / asset 同样按 principal 过滤）。
 */
@Entity
@Table(name = "mixcut_draft", indexes = {
        @Index(name = "idx_mixcut_draft_user", columnList = "userId"),
        @Index(name = "idx_mixcut_draft_template", columnList = "templateId"),
        @Index(name = "idx_mixcut_draft_updated", columnList = "updatedAt")
})
public class MixcutDraft {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String userId;

    @Column(length = 128, nullable = false)
    private String templateId;

    @Column(length = 256)
    private String templateName;

    @Column(length = 512)
    private String templateThumbnail;

    /** 实例名（用户可命名；默认 "{模版名} · 草稿"）。 */
    @Column(length = 256, nullable = false)
    private String name;

    /**
     * 创建 / 上次保存时的模版 version。重开实例时与当前模版 version 比对 —— 不一致则前端提示
     * 「模版已更新」，并按 slot_id reconcile（保留兼容绑定，标出新增 / 删除的素材位）。
     */
    @Column(length = 32)
    private String templateVersion;

    /** slot_bindings 完整 JSON（Record<slot_id, SlotBinding>）—— 实例的核心填充态。 */
    @Lob
    @Column(name = "slot_bindings_json", columnDefinition = "LONGTEXT")
    private String slotBindingsJson;

    /** 画布快照（{width,height,fps}）。 */
    @Lob
    @Column(name = "canvas_snapshot_json", columnDefinition = "LONGTEXT")
    private String canvasSnapshotJson;

    /** 槽位快照数组。 */
    @Lob
    @Column(name = "slots_snapshot_json", columnDefinition = "LONGTEXT")
    private String slotsSnapshotJson;

    /** 场景快照数组（[{id, label?, duration_sec, slot_ids[]}]，按场景顺序）。 */
    @Lob
    @Column(name = "scenes_snapshot_json", columnDefinition = "LONGTEXT")
    private String scenesSnapshotJson;

    /** 任务级扰动总开关 JSON。 */
    @Lob
    @Column(name = "perturbation_overrides_json", columnDefinition = "LONGTEXT")
    private String perturbationOverridesJson;

    /** 扰动贴图池配置 JSON（slot 级 Map）。 */
    @Lob
    @Column(name = "sticker_pool_json", columnDefinition = "LONGTEXT")
    private String stickerPoolJson;

    /** light / moderate / aggressive */
    @Column(length = 16, nullable = false)
    private String perturbationProfile;

    @Column(nullable = false)
    private int outputVariants;

    /** 关联商品 id（Product.id），可空。 */
    @Column(length = 64)
    private String productId;

    /** draft / archived（预留）。默认 draft。 */
    @Column(length = 16, nullable = false)
    @ColumnDefault("'draft'")
    private String status;

    /** 从本实例生成过几次任务（统计）。 */
    @Column(name = "generated_job_count", nullable = false)
    @ColumnDefault("0")
    private int generatedJobCount;

    /** 最近一次从本实例生成任务的时间。 */
    private OffsetDateTime lastGeneratedAt;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

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

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTemplateVersion() { return templateVersion; }
    public void setTemplateVersion(String templateVersion) { this.templateVersion = templateVersion; }

    public String getSlotBindingsJson() { return slotBindingsJson; }
    public void setSlotBindingsJson(String slotBindingsJson) { this.slotBindingsJson = slotBindingsJson; }

    public String getCanvasSnapshotJson() { return canvasSnapshotJson; }
    public void setCanvasSnapshotJson(String canvasSnapshotJson) { this.canvasSnapshotJson = canvasSnapshotJson; }

    public String getSlotsSnapshotJson() { return slotsSnapshotJson; }
    public void setSlotsSnapshotJson(String slotsSnapshotJson) { this.slotsSnapshotJson = slotsSnapshotJson; }

    public String getScenesSnapshotJson() { return scenesSnapshotJson; }
    public void setScenesSnapshotJson(String scenesSnapshotJson) { this.scenesSnapshotJson = scenesSnapshotJson; }

    public String getPerturbationOverridesJson() { return perturbationOverridesJson; }
    public void setPerturbationOverridesJson(String perturbationOverridesJson) { this.perturbationOverridesJson = perturbationOverridesJson; }

    public String getStickerPoolJson() { return stickerPoolJson; }
    public void setStickerPoolJson(String stickerPoolJson) { this.stickerPoolJson = stickerPoolJson; }

    public String getPerturbationProfile() { return perturbationProfile; }
    public void setPerturbationProfile(String perturbationProfile) { this.perturbationProfile = perturbationProfile; }

    public int getOutputVariants() { return outputVariants; }
    public void setOutputVariants(int outputVariants) { this.outputVariants = outputVariants; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getGeneratedJobCount() { return generatedJobCount; }
    public void setGeneratedJobCount(int generatedJobCount) { this.generatedJobCount = generatedJobCount; }

    public OffsetDateTime getLastGeneratedAt() { return lastGeneratedAt; }
    public void setLastGeneratedAt(OffsetDateTime lastGeneratedAt) { this.lastGeneratedAt = lastGeneratedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
