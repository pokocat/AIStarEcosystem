package com.aistareco.aep.dto;

import com.aistareco.aep.model.DistributionContent;

import java.util.Locale;

public record DistributionContentDto(
        String id,
        String title,
        String type,
        String status,
        int platforms,
        String totalViews,
        String date
) {
    public static DistributionContentDto from(DistributionContent c) {
        return new DistributionContentDto(
                c.getId(),
                c.getTitle(),
                c.getContentType(),
                lower(c.getStatus()),
                c.getPlatformCount(),
                formatCount(c.getTotalViewsCount()),
                c.getPublishDate() != null ? c.getPublishDate().toString() : null
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }

    private static String formatCount(long count) {
        if (count >= 100_000_000) return String.format("%.1f亿", count / 1e8);
        if (count >= 10_000) return String.format("%.1f万", count / 1e4);
        return String.valueOf(count);
    }
}
