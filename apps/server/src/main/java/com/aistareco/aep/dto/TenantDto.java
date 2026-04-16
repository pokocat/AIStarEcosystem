package com.aistareco.aep.dto;

import com.aistareco.aep.model.Tenant;

import java.time.Instant;
import java.util.Locale;

public record TenantDto(
        String id,
        String name,
        String type,
        String status,
        String ownerUserId,
        Instant createdAt,
        Instant updatedAt
) {
    public static TenantDto from(Tenant t) {
        return new TenantDto(
                t.getId(), t.getName(), lower(t.getType()), lower(t.getStatus()),
                t.getOwnerUserId(), t.getCreatedAt(), t.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
