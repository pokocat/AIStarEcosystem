package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧分发发布任务（v0.45，drama 子产品 /distribution/jobs）。
 *
 * 与 celebrity/sau 的 {@link PublishJob}（aep_publish_jobs，硬依赖社媒账号绑定 + cookie）
 * 刻意分离：drama 端没有社媒绑定 UI，这里是「瘦」发布任务，服务端做进度模拟
 * （queued → uploading → transcoding → publishing → live），用于打通项目 → 分发链路。
 * 生产要真发布时再接 sau（独立工作量）。
 *
 * DTO 字段镜像 packages/types/src/publish-job.ts 的 PublishJob 消费子集。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_publish_jobs")
public class DramaPublishJob {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** = Drama 项目 id（projectId）。 */
    @Column(name = "project_id")
    private String projectId;

    @Column(name = "platform_id")
    private String platformId;

    @Column(name = "platform_name")
    private String platformName;

    /** wire 小写：queued | uploading | transcoding | publishing | live | failed | cancelled */
    private String status;

    private int progress;

    @Column(name = "video_url")
    private String videoUrl;

    @Column(name = "external_url")
    private String externalUrl;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
