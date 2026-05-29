package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 素材运营 · 带货视频生成任务（真实调用视频大模型，异步 submit + 轮询）。
 *
 * 一次「生成 / 派生」对应 N 个 MaterialVideoJob（每条视频一个）。生命周期：
 *   queued → submitting → generating → succeeded | failed
 *
 * 视频大模型多为异步任务式 API（提交返回 task_id，轮询拿状态 + 成片 URL），故任务态
 * 入库 + 轮询：worker（@Async）提交后落 externalTaskId，再服务端轮询直到出片 / 超时；
 * 前端独立轮询本表（GET /api/material/videos/jobs/{id}）回显每个任务的进度与结果。
 *
 * 与 MixcutRenderJob 同惯例：JPA ddl-auto=update 自动建表 / 加列；H2 dev / MySQL prod 双兼容。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "material_video_job", indexes = {
        @Index(name = "idx_mvj_user", columnList = "owner_user_id"),
        @Index(name = "idx_mvj_status", columnList = "status"),
        @Index(name = "idx_mvj_script", columnList = "script_id")
})
public class MaterialVideoJob {

    @Id
    @Column(length = 64)
    private String id;

    /** 归属人（AepUser.id）；仅本人可见 / 可查。 */
    @Column(name = "owner_user_id", length = 64)
    private String ownerUserId;

    @Column(name = "script_id", length = 64)
    private String scriptId;

    @Column(name = "product_id", length = 64)
    private String productId;

    @Column(length = 256)
    private String name;

    /** baseline | variant */
    @Column(length = 16)
    private String kind;

    /** 派生来源视频 id（kind=variant 时指向 baseline 视频）。 */
    @Column(name = "parent_video_id", length = 64)
    private String parentVideoId;

    /** 提交给视频大模型的提示词。 */
    @Lob
    @Column(name = "prompt", columnDefinition = "LONGTEXT")
    private String prompt;

    /** 6 轴 VariantConfig 快照（JSON）。 */
    @Lob
    @Column(name = "variant_config_json", columnDefinition = "LONGTEXT")
    private String variantConfigJson;

    /** 完整 MaterialVideo 形状快照（JSON），回显 / 出片落库用。 */
    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "duration_sec")
    @ColumnDefault("0")
    private int durationSec;

    @Column(name = "aspect_ratio", length = 16)
    private String aspectRatio;

    /** queued | submitting | generating | succeeded | failed */
    @Column(length = 16, nullable = false)
    private String status;

    @Column(nullable = false)
    @ColumnDefault("0")
    private int progress;

    /** 视频大模型返回的异步任务 id（轮询用）。 */
    @Column(name = "external_task_id", length = 256)
    private String externalTaskId;

    /** 出片 URL（status=succeeded 时非空）。 */
    @Column(name = "video_url", length = 1024)
    private String videoUrl;

    @Column(name = "thumbnail_url", length = 1024)
    private String thumbnailUrl;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "provider_used", length = 128)
    private String providerUsed;

    @Column(name = "model_used", length = 128)
    private String modelUsed;

    /** 冻结积分（创建时按单价固化，后续改价不影响进行中的任务）。0 = 不计费。 */
    @Column(name = "credits_held", nullable = false)
    @ColumnDefault("0")
    private long creditsHeld;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
