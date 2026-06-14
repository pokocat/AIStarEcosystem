package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 短剧分发 · 发布任务（v0.65，drama 子产品）。
 * 状态机：queued → uploading → transcoding → publishing → live（失败 failed，可 retry / cancel）。
 * 进度由 DramaDistributionService 的 @Scheduled 推进（平台直传通道接入前为服务端模拟传输）。
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

    @Column(name = "project_id")
    private String projectId;

    @Column(name = "platform_id")
    private String platformId;

    @Column(name = "platform_name")
    private String platformName;

    /** queued | uploading | transcoding | publishing | live | failed | cancelled */
    private String status;

    /** 0-100 */
    private int progress;

    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Column(name = "external_url")
    private String externalUrl;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
