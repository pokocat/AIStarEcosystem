package com.aistareco.aep.dto;

import com.aistareco.aep.model.Drama;

import java.time.Instant;

public record DramaDto(
        String id,
        String title,
        String genre,
        int episodes,
        String role,
        String status,
        long views,
        long revenue,
        double rating,
        Instant releaseDate
) {
    public static DramaDto from(Drama d) {
        return new DramaDto(
                d.getId(),
                d.getTitle(),
                d.getGenre(),
                d.getEpisodes(),
                d.getRole(),
                d.getStatus() == null ? null : d.getStatus().getWire(),
                d.getViews(),
                d.getRevenue(),
                d.getRating(),
                d.getReleaseDate()
        );
    }
}
