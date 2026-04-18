package com.aistareco.aep.dto;

import com.aistareco.aep.model.FanActivity;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

public record FanActivityDto(
        String id,
        String user,
        String avatar,
        String action,
        String time,
        String type
) {
    public static FanActivityDto from(FanActivity a) {
        return new FanActivityDto(
                a.getId(),
                a.getUserName(),
                a.getAvatar(),
                a.getAction(),
                relativeTime(a.getCreatedAt()),
                lower(a.getType())
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
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
        if (days < 30) return days + "天前";
        return (days / 30) + "个月前";
    }
}
