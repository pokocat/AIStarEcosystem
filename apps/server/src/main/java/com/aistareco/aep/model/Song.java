package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Song — AI 歌曲。
 * product_spec.md §10.1（2026-08-29 修订）：{@code artistId}（= DigitalIp.id）改为可选 ——
 * 创作音乐不再要求先引入数字人；对接音乐发行开放平台需要"歌手"身份时再绑定。
 * 无艺人的歌曲归属由 {@code ownerUserId} 直接确定。
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

    /**
     * 演唱歌手 = DigitalIp.id。可空：创作音乐不要求先有艺人/数字人，
     * 后续对接发行平台需要歌手身份时再绑定。
     */
    @Column(name = "artist_id", length = 36)
    private String artistId;

    /**
     * 创作者 = AepUser.id。artistId 为空的歌曲靠它确定归属；
     * 老数据可为 null（归属经 artistId → DigitalIp.ownerUserId 推导）。
     */
    @Column(name = "owner_user_id", length = 36)
    private String ownerUserId;

    /**
     * 音频 OSS object key —— §4.7.4 真值。出 wire 时由 CdnUrlSigner.signKey 派生签名 URL，
     * 所以换 CDN 域名 / 切 driver / 调 key-prefix 都不需要迁数据。
     * 真实生成的歌曲一律落这里；{@link #audioUrl} 只为老数据保留。
     */
    @Column(name = "audio_cdn_key", length = 512)
    private String audioCdnKey;

    /**
     * @deprecated 历史字段：老数据里存的是完整 URL（含 mock 占位）。新代码写 {@link #audioCdnKey}；
     * 读取时 DTO 会在 audioCdnKey 缺失时回退到本字段并重签。
     */
    @Deprecated
    @Column(name = "audio_url", length = 512)
    private String audioUrl;

    /** 封面图 URL。 */
    @Column(name = "cover_url", length = 512)
    private String coverUrl;

    /** 歌词正文（MVP 纯文本）。 */
    @Column(columnDefinition = "LONGTEXT")
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
