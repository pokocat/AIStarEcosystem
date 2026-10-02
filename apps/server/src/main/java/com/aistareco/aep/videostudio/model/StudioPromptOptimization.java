package com.aistareco.aep.videostudio.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 视频生成区的一次「智能优化」（docs/video-studio-plan.md §9，表由 V37 建）。
 *
 * <p>厂商的优化接口是同步的，但最长要等十分钟上下，所以做成后台任务：落库 queued → worker running →
 * succeeded / failed。状态迁移一律走仓库里的条件更新（{@code where status = …}），worker 与兜底回收
 * 谁先改成终态谁去动积分，另一方什么都不做 —— 同一笔冻结不会既扣又退。
 *
 * <p>{@code creditsHeld}：进行中 = 冻结额，成功 = 扣除额，失败 = 已退回的额度；0 = 不收费。
 */
@Entity
@Table(name = "video_studio_prompt_optimization", indexes = {
        @Index(name = "uk_vs_opt_owner_request", columnList = "ownerUserId,clientRequestId", unique = true),
        @Index(name = "idx_vs_opt_status_updated", columnList = "status,updatedAt")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StudioPromptOptimization {

    public static final String STATUS_QUEUED = "queued";
    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_SUCCEEDED = "succeeded";
    public static final String STATUS_FAILED = "failed";

    @Id
    @Column(length = 32)
    private String id;

    @Column(nullable = false, length = 64)
    private String ownerUserId;

    @Column(nullable = false, length = 128)
    private String clientRequestId;

    /** 选中的端点；合成的默认项为 null（worker 按默认端点调）。 */
    @Column(length = 64)
    private String endpointId;

    @Column(nullable = false, length = 16)
    @Builder.Default
    private String status = STATUS_QUEUED;

    /** 校验通过的请求快照（{@code OptimizationSpec}），worker 只认这一份。 */
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String specJson;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String originalPrompt;

    @Column(columnDefinition = "LONGTEXT")
    private String optimizedPrompt;

    @Column(length = 128)
    private String vendorOptimizationId;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(nullable = false)
    @Builder.Default
    private long creditsHeld = 0L;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;

    public boolean isTerminal() {
        return STATUS_SUCCEEDED.equals(status) || STATUS_FAILED.equals(status);
    }
}
