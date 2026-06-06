package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * CelebrityProjectVideo — 项目下生成的单条视频（v2.7）。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code CelebrityProjectVideo}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "celebrity_project_videos")
public class CelebrityProjectVideo {

    @Id
    private String id;

    /** FK → celebrity_projects.id */
    @Column(nullable = false)
    private String projectId;

    @Column(nullable = false)
    private String projectName;

    /** FK → celebrity_stars.id */
    @Column(nullable = false)
    private String starId;

    @Column(nullable = false)
    private String starName;

    @Column(nullable = false)
    private String productName;

    /** 中文枚举：已发布 / 待审核 / 生成中 / 已驳回。 */
    @Column(nullable = false)
    private String status;

    /** 播放数文案（"12.4K"），生成中/待审核可能为空。 */
    private String plays;

    /** 时长枚举：15 / 30 / 60 秒。默认 0 表示尚未生成 / 未知。 */
    @Builder.Default
    @Column(nullable = false)
    @org.hibernate.annotations.ColumnDefault("0")
    private int durationSec = 0;

    /** CelebrityEngine：KeLing / HiGen / MiniMax。 */
    @Column(nullable = false)
    private String engine;

    @Column(length = 512, nullable = false)
    private String thumb;

    @Column(length = 512, nullable = false)
    private String videoUrl;

    @Column(nullable = false)
    private LocalDate createdAt;

    /** 运营 / 超管在视频库执行软删后置非空，列表默认过滤。 */
    private Instant deletedAt;
}
