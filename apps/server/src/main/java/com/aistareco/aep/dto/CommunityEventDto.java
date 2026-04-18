package com.aistareco.aep.dto;

import com.aistareco.aep.model.CommunityEvent;

import java.util.Locale;

public record CommunityEventDto(
        String id,
        String title,
        String type,
        String status,
        int participants,
        String date
) {
    public static CommunityEventDto from(CommunityEvent e) {
        return new CommunityEventDto(
                e.getId(),
                e.getTitle(),
                lower(e.getType()),
                lower(e.getStatus()),
                e.getParticipants(),
                e.getEventDate() != null ? e.getEventDate().toString() : null
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
