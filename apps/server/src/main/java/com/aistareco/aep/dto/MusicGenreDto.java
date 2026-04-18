package com.aistareco.aep.dto;

import com.aistareco.aep.model.MusicGenre;

public record MusicGenreDto(
        String id,
        String name,
        String icon,
        String color
) {
    public static MusicGenreDto from(MusicGenre g) {
        return new MusicGenreDto(
                g.getId(),
                g.getName(),
                g.getIcon(),
                g.getColor()
        );
    }
}
