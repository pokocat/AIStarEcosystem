package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 短剧分镜首帧生成任务。一次任务可生成 1-4 张候选图，结果存 resultJson。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_frame_job", indexes = {
        @Index(name = "idx_dfj_user", columnList = "owner_user_id"),
        @Index(name = "idx_dfj_status", columnList = "status"),
        @Index(name = "idx_dfj_project", columnList = "project_id"),
        @Index(name = "idx_dfj_shot", columnList = "shot_id")
})
public class DramaFrameJob {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "owner_user_id", length = 64, nullable = false)
    private String ownerUserId;

    @Column(name = "project_id", length = 64)
    private String projectId;

    @Column(name = "scene_id", length = 64)
    private String sceneId;

    @Column(name = "shot_id", length = 64)
    private String shotId;

    @Column(name = "episode_no")
    private Integer episodeNo;

    /** shot | short */
    @Column(length = 16)
    private String kind;

    @Column(length = 256)
    private String name;

    @Lob
    @Column(name = "request_json", columnDefinition = "LONGTEXT")
    private String requestJson;

    @Lob
    @Column(name = "result_json", columnDefinition = "LONGTEXT")
    private String resultJson;

    /** queued | running | succeeded | failed */
    @Column(length = 16, nullable = false)
    private String status;

    @Column(nullable = false)
    @ColumnDefault("0")
    private int progress;

    @Column(length = 64)
    private String stage;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
