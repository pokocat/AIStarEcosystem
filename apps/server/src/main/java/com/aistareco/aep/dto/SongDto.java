package com.aistareco.aep.dto;

import com.aistareco.aep.model.Song;

import java.time.Instant;
import java.util.Locale;

/**
 * SongDto — 对接前端 {@code apps/web/src/types/music.ts#Song}。
 * 字段名严格匹配 TS 侧（见 product_spec.md §10.2）。
 */
public record SongDto(
        String id,
        String title,
        String genre,
        int duration,
        String status,
        long plays,
        long revenue,
        double rating,
        Instant releaseDate,
        // ── product_spec.md §10.2 新增字段 ───────────────────────────────────
        String artistId,
        /** 艺人名（admin 列表便利字段；简单 /me 视图下可为 null）。 */
        String artistName,
        /** 所属工作室 id（由 artist 反查，冗余，便于筛选）。 */
        String studioId,
        /** 所属工作室名（admin 列表便利字段）。 */
        String studioName,
        String audioUrl,
        String coverUrl,
        String lyrics,
        String modelVersion,
        String thinkDepth,
        Long creditsSpent,
        Instant createdAt
) {
    public static SongDto from(Song s) {
        return from(s, null, null, null);
    }

    public static SongDto from(Song s, String artistName, String studioId, String studioName) {
        return new SongDto(
                s.getId(),
                s.getTitle(),
                s.getGenre(),
                s.getDuration(),
                lower(s.getStatus()),
                s.getPlays(),
                s.getRevenue(),
                s.getRating(),
                s.getReleaseDate(),
                s.getArtistId(),
                artistName,
                studioId,
                studioName,
                s.getAudioUrl(),
                s.getCoverUrl(),
                s.getLyrics(),
                s.getModelVersion(),
                s.getThinkDepth(),
                s.getCreditsSpent(),
                s.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
