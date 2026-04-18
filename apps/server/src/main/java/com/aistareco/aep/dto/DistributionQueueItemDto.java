package com.aistareco.aep.dto;

import com.aistareco.aep.model.DistributionQueueItem;

import java.time.LocalDate;
import java.util.Locale;

public record DistributionQueueItemDto(
        String id,
        String title,
        String artist,
        String type,
        String status,
        int platforms,
        LocalDate date
) {
    public static DistributionQueueItemDto from(DistributionQueueItem item) {
        return new DistributionQueueItemDto(
                item.getId(),
                item.getTitle(),
                item.getArtistName(),
                item.getType() == null ? null : item.getType().getWire(),
                lower(item.getStatus()),
                item.getPlatformCount(),
                item.getSubmitDate()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
