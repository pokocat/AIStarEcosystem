package com.aistareco.aep.dto;

import com.aistareco.aep.model.AuditLog;

import java.time.Instant;
import java.util.Locale;

public record AuditLogDto(
        String id,
        String userId,
        String username,
        String tenantId,
        String action,
        String resourceType,
        String resourceId,
        String errorCode,
        String ipAddress,
        String userAgent,
        String appCode,
        String result,
        String detail,
        Instant createdAt
) {
    public static AuditLogDto from(AuditLog a) {
        return new AuditLogDto(
                a.getId(), a.getUserId(), a.getUsername(), a.getTenantId(),
                a.getAction(), a.getResourceType(), a.getResourceId(),
                a.getErrorCode(),
                a.getIpAddress(), a.getUserAgent(), a.getAppCode(), lower(a.getResult()),
                a.getDetail(), a.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
