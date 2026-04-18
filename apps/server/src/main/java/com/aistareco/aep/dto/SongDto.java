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
        String audioUrl,
        String coverUrl,
        String lyrics,
        String modelVersion,
        String thinkDepth,
        Long creditsSpent,
        Instant createdAt
) {
    public static SongDto from(Song s) {
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
