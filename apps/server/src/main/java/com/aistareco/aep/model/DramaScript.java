package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * 短剧脚本（v0.43+，drama 子产品）。
 *
 * 与 celebrity 的 MaterialScript 同惯例：核心字段 + 完整脚本 JSON（payloadJson）。
 * 脚本结构（payloadJson）：
 *   { id, title, logline, genre, duration_sec, status,
 *     scenes: [ { heading, summary, shot, dialogue, duration_sec } ... ] }
 * 其中 shot=画面/分镜（怎么拍），dialogue=台词/旁白（念什么）—— 对齐 celebrity 的脚本语义。
 *
 * 按 ownerUserId 严格隔离；软删用 deletedAt。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "drama_scripts")
public class DramaScript {

    @Id
    private String id;

    @Column(name = "owner_user_id")
    private String ownerUserId;

    private String title;
    private String genre;

    @Column(name = "duration_sec")
    private int durationSec;

    /** draft | ready */
    private String status;

    /** v0.45：多集短剧分组 —— 同 seriesId 的多行 = 一部剧集，按 episodeNo 排序。 */
    @Column(name = "series_id")
    private String seriesId;

    @Column(name = "episode_no")
    @ColumnDefault("0")
    private int episodeNo;

    /** v0.45：成片已归入的项目流水线 Drama 项目 id（publish-to-project 桥接）。 */
    @Column(name = "drama_id")
    private String dramaId;

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
