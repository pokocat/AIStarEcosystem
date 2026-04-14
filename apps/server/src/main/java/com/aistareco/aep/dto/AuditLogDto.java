package com.aistareco.aep.dto;

import com.aistareco.aep.model.AuditLog;

import java.time.Instant;

public record AuditLogDto(
        String id,
        String userId,
        String tenantId,
        String action,
        String resourceType,
        String resourceId,
        String ipAddress,
        String userAgent,
        AuditLog.AuditResult result,
        String detail,
        Instant createdAt
) {
    public static AuditLogDto from(AuditLog a) {
        return new AuditLogDto(
                a.getId(), a.getUserId(), a.getTenantId(),
                a.getAction(), a.getResourceType(), a.getResourceId(),
                a.getIpAddress(), a.getUserAgent(), a.getResult(),
                a.getDetail(), a.getCreatedAt()
        );
    }
}
