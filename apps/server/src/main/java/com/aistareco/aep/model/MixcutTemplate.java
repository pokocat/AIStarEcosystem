package com.aistareco.aep.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * 混剪模板（v0.12+）—— 替代前端 mockTemplates + localStorage 的纯前端方案。
 *
 * 数据语义：
 *   - 工厂模板：isFactory=true, ownerScope="factory", ownerUserId=null —— 由 MixcutTemplateSeeder 生成
 *   - 用户模板：isFactory=false, ownerScope=ownerUserId, 由用户「保存」生成
 *   - 同一 templateId 可同时存在 factory 版本与各 user 版本
 *     (listForUser 时 user 版本覆盖同 templateId 的 factory)
 *
 * 嵌套结构（canvas / scenes / quality_gate）以 JSON TEXT 存储，
 * 字段名 wire 上 snake_case 与前端 Template 接口对齐。
 *
 * 注：使用合成 PK (templateId + "::" + ownerScope) 以满足
 * (templateId, ownerScope) 唯一约束；wire 上只暴露 templateId。
 */
@Entity
@Table(name = "mixcut_template",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_mixcut_template_id_owner",
                        columnNames = {"templateId", "ownerScope"})
        },
        indexes = {
                @Index(name = "idx_mixcut_template_category", columnList = "category"),
                @Index(name = "idx_mixcut_template_tier", columnList = "requiredTier"),
                @Index(name = "idx_mixcut_template_factory", columnList = "isFactory"),
                @Index(name = "idx_mixcut_template_owner", columnList = "ownerUserId")
        })
public class MixcutTemplate {

    /** 合成 PK：<templateId>::<ownerScope>，wire 上不暴露 */
    @Id
    @Column(length = 200)
    private String id;

    /** Wire-level id，对应前端 Template.template_id */
    @Column(length = 128, nullable = false)
    private String templateId;

    /** 唯一约束哨兵：factory 行为 "factory"，user 行为 userId（不允许 null） */
    @Column(length = 64, nullable = false)
    private String ownerScope;

    /** factory 行为 null；user 行等于 ownerScope */
    @Column(length = 64)
    private String ownerUserId;

    @Column(nullable = false)
    private boolean isFactory;

    @Column(length = 256, nullable = false)
    private String name;

    @Column(length = 32, nullable = false)
    private String version;

    @Column(length = 64, nullable = false)
    private String category;

    /** trial / basic / standard / professional / annual_pro / city_agent */
    @Column(length = 32, nullable = false)
    private String requiredTier;

    /** light / moderate / aggressive */
    @Column(length = 16, nullable = false)
    private String perturbationProfile;

    @Column(nullable = false)
    private int outputVariantsDefault;

    @Column(length = 512)
    private String thumbnailUrl;

    @Column(length = 512)
    private String coverVideoUrl;

    /** 逗号分隔，wire 上转 string[] */
    @Column(length = 1024)
    private String tagsCsv;

    /** TemplateCanvas JSON：{ width, height, duration, fps, background_color } */
    @Lob
    @Column(name = "canvas_json", columnDefinition = "LONGTEXT", nullable = false)
    private String canvasJson;

    /** TemplateScene[] JSON */
    @Lob
    @Column(name = "scenes_json", columnDefinition = "LONGTEXT", nullable = false)
    private String scenesJson;

    /** { min_phash_distance, max_retries } */
    @Column(name = "quality_gate_json", columnDefinition = "LONGTEXT", nullable = false)
    private String qualityGateJson;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    public static String pkOf(String templateId, String ownerScope) {
        return templateId + "::" + ownerScope;
    }

    // ── getters / setters ─────────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public String getOwnerScope() { return ownerScope; }
    public void setOwnerScope(String ownerScope) { this.ownerScope = ownerScope; }

    public String getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(String ownerUserId) { this.ownerUserId = ownerUserId; }

    public boolean isFactory() { return isFactory; }
    public void setFactory(boolean factory) { isFactory = factory; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getRequiredTier() { return requiredTier; }
    public void setRequiredTier(String requiredTier) { this.requiredTier = requiredTier; }

    public String getPerturbationProfile() { return perturbationProfile; }
    public void setPerturbationProfile(String perturbationProfile) { this.perturbationProfile = perturbationProfile; }

    public int getOutputVariantsDefault() { return outputVariantsDefault; }
    public void setOutputVariantsDefault(int outputVariantsDefault) { this.outputVariantsDefault = outputVariantsDefault; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public String getCoverVideoUrl() { return coverVideoUrl; }
    public void setCoverVideoUrl(String coverVideoUrl) { this.coverVideoUrl = coverVideoUrl; }

    public String getTagsCsv() { return tagsCsv; }
    public void setTagsCsv(String tagsCsv) { this.tagsCsv = tagsCsv; }

    public String getCanvasJson() { return canvasJson; }
    public void setCanvasJson(String canvasJson) { this.canvasJson = canvasJson; }

    public String getScenesJson() { return scenesJson; }
    public void setScenesJson(String scenesJson) { this.scenesJson = scenesJson; }

    public String getQualityGateJson() { return qualityGateJson; }
    public void setQualityGateJson(String qualityGateJson) { this.qualityGateJson = qualityGateJson; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
