package com.aistareco.aep.aiavatar.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 异步任务（任务书 §5 Job / §7 异步任务中心）。
 *
 * 所有 AI 生成都是异步 Job：capability 决定走哪个 Provider；进度经内存 registry → SSE 推前端。
 *
 * 监控线程 {@link com.aistareco.aep.aiavatar.service.AiAvatarJobWatchdog} 用 heartbeatAt + attempts 判定
 * 「卡死 / 异常中断」的任务并自动续跑（任务书用户附加硬要求）。
 */
@Entity
@Table(name = "aiavatar_job", indexes = {
        @Index(name = "idx_aiavatar_job_owner", columnList = "ownerUserId"),
        @Index(name = "idx_aiavatar_job_status", columnList = "status"),
        @Index(name = "idx_aiavatar_job_avatar", columnList = "avatarId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarJob {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 64, nullable = false)
    private String ownerUserId;

    @Column(length = 64)
    private String avatarId;

    /** 产出的版本 id（成功后回填）。 */
    @Column(length = 64)
    private String versionId;

    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private AiAvatarCapability capability;

    @Enumerated(EnumType.STRING)
    @Column(length = 16, nullable = false)
    private AiAvatarJobStatus status;

    @Column(nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    private int progress = 0;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private AiAvatarProviderMode providerMode;

    /** 实现来源标识（InstantID / SDXL / TripoSR / SVD / MOCK …），前端「来源角标」用。 */
    @Column(length = 48)
    private String engine;

    @Column(length = 256)
    private String title;

    @Lob
    @Column(name = "input_json", columnDefinition = "LONGTEXT")
    private String inputJson;

    @Lob
    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    private String resultJson;

    @Column(length = 1024)
    private String errorMessage;

    /** 已尝试次数（含首次）。监控线程据此判断是否还能重试。 */
    @Column(nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    private int attempts = 0;

    @Column(nullable = false)
    @ColumnDefault("3")
    @Builder.Default
    private int maxAttempts = 3;

    @Column(nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    private long creditsHeld = 0;

    @Column(nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    private long creditsPerUnit = 0;

    /** worker 存活心跳；running 任务超过阈值无心跳 → 视为异常中断。 */
    private OffsetDateTime heartbeatAt;

    /** 批次 id（标准图集 = 一个 batch；衍生 3D+视频 = 一个 batch）。 */
    @Column(length = 64)
    private String batchId;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime startedAt;

    private OffsetDateTime completedAt;
}
