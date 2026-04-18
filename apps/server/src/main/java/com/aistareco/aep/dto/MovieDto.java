package com.aistareco.aep.dto;

import com.aistareco.aep.model.Movie;

import java.util.Locale;

public record MovieDto(
        String id,
        String title,
        String genre,
        String role,
        String status,
        long boxOffice,
        long revenue,
        double rating
) {
    public static MovieDto from(Movie m) {
        return new MovieDto(
                m.getId(),
                m.getTitle(),
                m.getGenre(),
                lower(m.getRole()),
                m.getStatus() == null ? null : m.getStatus().getWire(),
                m.getBoxOffice(),
                m.getRevenue(),
                m.getRating()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
