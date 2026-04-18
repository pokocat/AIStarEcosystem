package com.aistareco.aep.dto;

import com.aistareco.aep.model.PlatformConnection;

import java.time.Instant;
import java.util.Locale;

public record PlatformConnectionDto(
        String id,
        String tenantId,
        String userId,
        String platformId,
        String status,
        Instant connectedAt
) {
    public static PlatformConnectionDto from(PlatformConnection c) {
        return new PlatformConnectionDto(
                c.getId(), c.getTenantId(), c.getUserId(), c.getPlatformId(),
                c.getStatus() == null ? null : c.getStatus().name().toLowerCase(Locale.ROOT),
                c.getConnectedAt()
        );
    }
}
