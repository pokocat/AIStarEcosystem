package com.aistareco.aep.dto;

import com.aistareco.aep.model.Tenant;

import java.time.Instant;
import java.util.Locale;

public record TenantDto(
        String id,
        String name,
        String kind,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
    public static TenantDto from(Tenant t) {
        return new TenantDto(
                t.getId(), t.getName(), lower(t.getKind()), lower(t.getStatus()),
                t.getCreatedAt(), t.getUpdatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
