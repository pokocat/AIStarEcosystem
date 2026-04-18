package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

/**
 * Album = AI 歌手歌单 / 合集（product_spec.md §10.4）。
 * 数字音乐没有实体专辑发行概念；Album 降级为歌曲合集：
 *   - 新规范字段：{@code artistId} + {@code trackIds}
 *   - 遗留字段（{@code status} / {@code sales} / {@code revenue} / {@code trackCount}）
 *     仅保留列，供 admin 存量页面过渡使用，P1 迁"歌单运营"后移除。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_albums")
public class Album {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(length = 512)
    private String cover;

    // ── 新规范字段 ─────────────────────────────────────────────────────────

    /** 所属 AI 艺人 = DigitalIp.id。 */
    @Column(name = "artist_id", length = 36)
    private String artistId;

    /** 收录歌曲顺序（歌单曲序）；JSON 列，存 Song.id 数组。 */
    @Column(name = "track_ids", columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> trackIds;

    @Column(name = "created_at")
    private Instant createdAt;

    // ── 遗留字段（@deprecated；P1 迁移后移除） ─────────────────────────────

    /** @deprecated 由 trackIds.size() 派生 */
    @Deprecated
    private int trackCount;

    /** @deprecated Album 无发布生命周期 */
    @Deprecated
    @Enumerated(EnumType.STRING)
    private AlbumStatus status;

    /** @deprecated 数字音乐无销售 */
    @Deprecated
    private long sales;

    /** @deprecated 收入从歌曲聚合 */
    @Deprecated
    private long revenue;

    public enum AlbumStatus {
        PLANNING, RECORDING, RELEASED
    }
}
