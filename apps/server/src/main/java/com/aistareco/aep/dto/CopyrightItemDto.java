package com.aistareco.aep.dto;

import com.aistareco.aep.model.CopyrightItem;

import java.time.LocalDate;
import java.util.Locale;

public record CopyrightItemDto(
        String id,
        String title,
        String artist,
        String type,
        LocalDate submitted,
        String status
) {
    public static CopyrightItemDto from(CopyrightItem item) {
        return new CopyrightItemDto(
                item.getId(),
                item.getTitle(),
                item.getArtistName(),
                item.getContentType(),
                item.getSubmittedDate(),
                lower(item.getStatus())
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
