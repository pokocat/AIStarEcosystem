package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseKey;

import java.time.Instant;

public record LicenseKeyDto(
        String id,
        String batchId,
        String maskedCode,
        String status,
        String activatedByUserId,
        String activatedTenantId,
        Instant activatedAt,
        Instant expiresAt,
        Instant createdAt
) {
    public static LicenseKeyDto from(LicenseKey k) {
        return new LicenseKeyDto(
                k.getId(), k.getBatchId(), k.getMaskedCode(), k.getStatus().name().toLowerCase(),
                k.getActivatedByUserId(), k.getActivatedTenantId(),
                k.getActivatedAt(), k.getExpiresAt(), k.getCreatedAt()
        );
    }
}
