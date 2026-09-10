package com.aistareco.aep.clip.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/**
 * 段级（单镜头）生成任务。整片出片是 {@link ClipRenderJob}，这张只管「第 N 镜单独生成一次」。
 *
 * <p>{@code quotedCredits} 是报价、{@code credits} 是实扣，故意分成两列：
 * 只有 worker 把 status 落到 succeeded 时才把报价抄进 credits，失败/取消恒为 0。
 * 「成功才扣」因此是可查的库状态，不是一句口头承诺。
 */
@Entity
@Table(name = "clip_shot_job", indexes = {
        @Index(name = "idx_clip_shot_job_shot", columnList = "externalOwnerId,projectId,shotNo,createdAt"),
        @Index(name = "idx_clip_shot_job_status_heartbeat", columnList = "status,heartbeatAt"),
        @Index(name = "uk_clip_shot_job_request", columnList = "externalOwnerId,clientRequestId", unique = true)
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClipShotJob {
    @Id @Column(length = 64) private String id;
    @Column(nullable = false, length = 128) private String externalOwnerId;
    @Column(nullable = false, length = 64) private String projectId;
    /** 镜头序号（materialize 后的第几镜，从 1 开始），不是句号。 */
    @Column(nullable = false) private int shotNo;
    @Column(nullable = false, length = 100) private String clientRequestId;
    @Column(nullable = false, length = 16) private String model;
    @Column(nullable = false, length = 16) @Builder.Default private String status = "queued";
    @Builder.Default private int progress = 0;
    @Builder.Default private int quotedCredits = 0;
    @Builder.Default private int credits = 0;
    @Column(length = 128) private String fingerprint;
    @Column(columnDefinition = "TEXT") private String prompt;
    @Column(length = 512) private String artifactCdnKey;
    @Column(length = 512) private String artifactPosterCdnKey;
    @Builder.Default private double artifactDurationSec = 0;
    @Column(length = 128) private String engineTaskId;
    /** 出镜段先合成的那条配音。留着是为了重试时不用再花一次 TTS 的点数。 */
    @Column(length = 512) private String audioCdnKey;
    @Column(length = 64) private String errorCode;
    @Column(columnDefinition = "TEXT") private String errorMessage;
    @Builder.Default private boolean mock = false;
    @Column(length = 64) private String leaseOwner;
    private Instant leaseUntil;
    private Instant heartbeatAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
}
