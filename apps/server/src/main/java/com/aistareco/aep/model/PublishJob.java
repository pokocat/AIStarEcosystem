package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * sau 分发任务：把 CelebrityProject (或后续 drama / music project) 的一条视频，
 * 上传到指定 SocialAccount 对应平台的发布管道。
 *
 * 一次批量创建 (CreatePublishJobInput.targets[]) 会按目标数量产生多条 PublishJob 行，
 * 每条独立扣费 + 调度。externalTaskId 是 sau-service 返回的远端任务 id，作 callback 幂等 key。
 *
 * 不复用 mock 阶段的 DistributionQueueItem —— 那个是占位数据，不进真实业务流。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "aep_publish_jobs",
    indexes = {
        @Index(name = "idx_publish_user_created", columnList = "user_id, created_at"),
        @Index(name = "idx_publish_project", columnList = "project_id"),
        @Index(name = "idx_publish_status", columnList = "status"),
        @Index(name = "idx_publish_external_task", columnList = "external_task_id", unique = true)
    }
)
public class PublishJob {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "social_account_id", nullable = false)
    private String socialAccountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SocialPlatform platform;

    /** 冗余的展示用平台 id (与 frontend Platform.id 对齐) */
    @Column(name = "platform_id")
    private String platformId;

    /** 冗余的展示用平台名 */
    @Column(name = "platform_name", length = 128)
    private String platformName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(32)")
    private PublishJobStatus status;

    @Builder.Default
    @Column(nullable = false)
    private int progress = 0;

    /** sau-service 拉取的源视频 URL (公网可访问) */
    @Column(name = "video_url", length = 1024)
    private String videoUrl;

    @Column(length = 512)
    private String title;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    /** 标签数组，逗号分隔存储 */
    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Column(name = "cover_url", length = 1024)
    private String coverUrl;

    // ── 抖音商品挂载（蓝V / 橱窗带货）─────────────────────────────────────
    // 仅抖音消费这两个字段；nullable —— 非带货视频或非抖音平台留空。
    // sau-service 在 _upload_douyin 里透传给 DouYinVideo(productLink=..,
    // productTitle=..)，触发视频画面下方"立即购买"挂件。

    @Column(name = "product_link", length = 1024)
    private String productLink;

    @Column(name = "product_title", length = 256)
    private String productTitle;

    /** sau-service 返回的远端任务 id；callback 用此 key 做幂等 */
    @Column(name = "external_task_id", length = 128)
    private String externalTaskId;

    /** 平台发布后的可访问 URL */
    @Column(name = "external_url", length = 1024)
    private String externalUrl;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "LONGTEXT")
    private String errorMessage;

    /** 本任务实际扣的积分；失败也不退 */
    @Column(name = "credits_spent")
    private Long creditsSpent;

    /**
     * 当 status=AWAITING_USER 时，sau-service 透传的人机交互上下文 JSON。
     * 其它状态期间为 null。
     *
     * JSON 结构 mirror packages/types/src/publish-job.ts InteractionRequired：
     *   { kind, prompt, phone_masked?, can_resend_at?, created_at }
     *
     * 进/出 awaiting_user 由 callback 同时变更 status + interactionRequiredJson；
     * 用户在 /me/publish-jobs/{id}/interact 提交后，sau-service 在 page 上
     * 填完验证码 → 再发 callback 推 status=PUBLISHING + interactionRequired=null。
     */
    @Column(name = "interaction_required", columnDefinition = "LONGTEXT")
    private String interactionRequiredJson;

    @Column(name = "scheduled_at")
    private Instant scheduledAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (status == null) status = PublishJobStatus.QUEUED;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
