package com.aistareco.aep.dto;

import com.aistareco.aep.model.Platform;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

public record PlatformDto(
        String id,
        String name,
        String icon,
        String category,
        String status,
        String followers,
        String lastSync
) {
    public static PlatformDto from(Platform p) {
        return new PlatformDto(
                p.getId(),
                p.getName(),
                p.getIcon(),
                lower(p.getCategory()),
                lower(p.getStatus()),
                formatCount(p.getFollowersCount()),
                relativeTime(p.getLastSyncAt())
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

    private static String relativeTime(Instant instant) {
        if (instant == null) return "";
        Duration d = Duration.between(instant, Instant.now());
        long minutes = d.toMinutes();
        if (minutes < 1) return "刚刚";
        if (minutes < 60) return minutes + "分钟前";
        long hours = d.toHours();
        if (hours < 24) return hours + "小时前";
        long days = d.toDays();
        return days + "天前";
    }
}
