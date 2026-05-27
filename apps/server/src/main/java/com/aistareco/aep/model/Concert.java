package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

/**
 * Concert = 线上直播活动（product_spec.md §10.5）。
 * MVP 只用新字段 artistIds + streamUrl；旧字段（venue / ticketPrice / capacity /
 * soldTickets / revenue）仅供 admin 过渡页面使用，P1 迁"线上直播管理"后移除。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_concerts")
public class Concert {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private Instant date;

    @Enumerated(EnumType.STRING)
    private ConcertStatus status;

    // ── 新规范字段 ─────────────────────────────────────────────────────────

    /** 参演 AI 艺人 ID 列表。 */
    @Column(name = "artist_ids", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> artistIds;

    /** 线上直播链接。 */
    @Column(name = "stream_url", length = 512)
    private String streamUrl;

    // ── 遗留字段（@deprecated；P1 迁移后移除） ─────────────────────────────

    /** @deprecated 数字音乐无线下场馆 */
    @Deprecated
    private String venue;

    /** @deprecated 无票务 */
    @Deprecated
    private long ticketPrice;

    /** @deprecated 无票务 */
    @Deprecated
    private int capacity;

    /** @deprecated 无票务 */
    @Deprecated
    private int soldTickets;

    /** @deprecated 收入从歌曲聚合 */
    @Deprecated
    private long revenue;

    public enum ConcertStatus {
        PLANNING, SELLING, COMPLETED
    }
}
