package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Song — AI 歌曲。
 * product_spec.md §10.1：必须绑定 {@code artistId}（= DigitalIp.id），这是对接音乐发行
 * 开放平台时外部元数据中的"歌手"身份。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_songs")
public class Song {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String genre;

    /** Duration in seconds. */
    private int duration;

    @Enumerated(EnumType.STRING)
    private SongStatus status;

    private long plays;
    private long revenue;
    private double rating;
    private Instant releaseDate;

    // ── product_spec.md §10.2 新增字段 ────────────────────────────────────────

    /** 演唱歌手 = DigitalIp.id；新建歌曲时必填，一首歌必属一个艺人（N:1）。 */
    @Column(name = "artist_id", length = 36, nullable = false)
    private String artistId;

    /** 音频资源地址（当前 mock 占位；后续迁 OSS / 对象存储）。 */
    @Column(name = "audio_url", length = 512)
    private String audioUrl;

    /** 封面图 URL。 */
    @Column(name = "cover_url", length = 512)
    private String coverUrl;

    /** 歌词正文（MVP 纯文本）。 */
    @Column(columnDefinition = "TEXT")
    private String lyrics;

    /** 生成模型版本（如 "suno-v3"），由 admin 工作流计费配置下发。 */
    @Column(name = "model_version", length = 64)
    private String modelVersion;

    /** 生成深度档位：fast / standard / deep。 */
    @Column(name = "think_depth", length = 16)
    private String thinkDepth;

    /** 本次生成实际扣费（credits 原始值）。 */
    @Column(name = "credits_spent")
    private Long creditsSpent;

    @Column(name = "created_at")
    private Instant createdAt;

    public enum SongStatus {
        RECORDING, MIXING, RELEASED
    }
}
