package com.aistareco.aep.dto;

import com.aistareco.aep.model.Studio;

import java.time.Instant;
import java.util.Locale;

public record StudioDto(
        String id,
        String ownerUserId,
        String name,
        String kind,
        String bio,
        String logoUrl,
        String contactEmail,
        String contactPhone,
        Instant createdAt,
        Instant updatedAt
) {
    public static StudioDto from(Studio s) {
        return new StudioDto(
                s.getId(), s.getOwnerUserId(), s.getName(),
                lower(s.getKind()), s.getBio(), s.getLogoUrl(),
                s.getContactEmail(), s.getContactPhone(),
                s.getCreatedAt(), s.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
