package com.aistareco.aep.dto;

import com.aistareco.aep.model.Tenant;

import java.time.Instant;

public record TenantDto(
        String id,
        String name,
        Tenant.TenantType type,
        Tenant.TenantStatus status,
        String ownerUserId,
        Instant createdAt,
        Instant updatedAt
) {
    public static TenantDto from(Tenant t) {
        return new TenantDto(
                t.getId(), t.getName(), t.getType(), t.getStatus(),
                t.getOwnerUserId(), t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
