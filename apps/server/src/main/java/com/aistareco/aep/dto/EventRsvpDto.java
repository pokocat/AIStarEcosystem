package com.aistareco.aep.dto;

import com.aistareco.aep.model.EventRsvp;

import java.time.Instant;

public record EventRsvpDto(
        String eventId,
        String userId,
        Instant createdAt
) {
    public static EventRsvpDto from(EventRsvp r) {
        return new EventRsvpDto(r.getEventId(), r.getUserId(), r.getCreatedAt());
    }
}
