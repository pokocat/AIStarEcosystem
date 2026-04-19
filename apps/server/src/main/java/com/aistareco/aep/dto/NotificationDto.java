package com.aistareco.aep.dto;

import com.aistareco.aep.model.Notification;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

public record NotificationDto(
        String id,
        String type,
        String title,
        String desc,
        String time,
        boolean read,
        Audience audience
) {
    /** 推送对象。scope: all | studio | artist | account. 对齐前端 NotificationAudience 契约。 */
    public record Audience(String scope, String targetId, String targetName) {}

    public static NotificationDto from(Notification n) {
        return new NotificationDto(
                n.getId(),
                lower(n.getType()),
                n.getTitle(),
                n.getDescription(),
                relativeTime(n.getCreatedAt()),
                n.isRead(),
                new Audience("all", null, null)
        );
    }

    private static String relativeTime(Instant then) {
        if (then == null) return "";
        long seconds = Duration.between(then, Instant.now()).getSeconds();
        if (seconds < 60) return seconds + "s";
        long minutes = seconds / 60;
        if (minutes < 60) return minutes + "min";
        long hours = minutes / 60;
        if (hours < 24) return hours + "h";
        long days = hours / 24;
        return days + "d";
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
