package com.aistareco.aep.dto;

import com.aistareco.aep.model.Album;

import java.util.Locale;

public record AlbumDto(
        String id,
        String name,
        String cover,
        int trackCount,
        String status,
        long sales,
        long revenue
) {
    public static AlbumDto from(Album a) {
        return new AlbumDto(
                a.getId(),
                a.getName(),
                a.getCover(),
                a.getTrackCount(),
                lower(a.getStatus()),
                a.getSales(),
                a.getRevenue()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
