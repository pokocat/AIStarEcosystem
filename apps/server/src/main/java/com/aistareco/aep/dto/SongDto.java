package com.aistareco.aep.dto;

import com.aistareco.aep.model.Song;

import java.time.Instant;
import java.util.Locale;

public record SongDto(
        String id,
        String title,
        String genre,
        int duration,
        String status,
        long plays,
        long revenue,
        double rating,
        Instant releaseDate
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
                s.getReleaseDate()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
