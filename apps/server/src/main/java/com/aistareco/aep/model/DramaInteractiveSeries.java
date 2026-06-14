package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 互动短剧 · 剧集分支图（v0.74，drama 子产品「剧情互动」）。
 *
 * 一部剧 = 一张剧集有向图，整张图内嵌一行的 payloadJson：
 *   { id, title, genre, logline, status, start_episode_id,
 *     episodes: [ {
 *       id, title, branch_label?, synopsis?, scenes?[], duration_sec?,
 *       gen_status, video_job_id?, video_url?,
 *       interaction?: { prompt, choices:[{id,label,next_episode_id}], countdown_sec?, default_choice_id? },
 *       next_episode_id?, is_ending?, ending_label?
 *     } ... ] }
 *
 * 互动只发生在「剧集之间」（看完某集弹选项，观众的选择决定下一集播哪条分支）。
 * 与 DramaScript 同惯例：核心字段 + 完整 JSON（payloadJson）；按 ownerUserId 隔离，软删 deletedAt。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_interactive_series")
public class DramaInteractiveSeries {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String title;
    private String genre;

    /** draft | ready（全部剧集已生成 → ready） */
    private String status;

    @Lob
    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;
}
