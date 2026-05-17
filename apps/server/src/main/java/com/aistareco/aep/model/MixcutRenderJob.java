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
}
