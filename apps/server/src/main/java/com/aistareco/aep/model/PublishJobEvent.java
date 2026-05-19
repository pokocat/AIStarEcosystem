package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 发布任务的不可变事件流；每次状态推进 / 进度更新 / 错误都写一行。
 *
 * 用途：
 *   - 审计：还原任务执行轨迹
 *   - 排错：sau-service callback 顺序 / 重试次数
 *   - 合规：每次上传都需要 userId × socialAccountId 可追溯
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "aep_publish_job_events",
    indexes = {
        @Index(name = "idx_publish_event_job", columnList = "job_id, at")
    }
)
public class PublishJobEvent {

    @Id
    private String id;

    @Column(name = "job_id", nullable = false)
    private String jobId;

    /** 事件类型：transition / progress / callback / error / system */
    @Column(name = "kind", nullable = false, length = 32)
    private String kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status")
    private PublishJobStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status")
    private PublishJobStatus toStatus;

    @Column(name = "progress")
    private Integer progress;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "at", nullable = false)
    private Instant at;

    @PrePersist
    void onCreate() {
        if (at == null) at = Instant.now();
    }
}
