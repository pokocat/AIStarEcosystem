package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseKey;

import java.time.Instant;
import java.util.Locale;

public record LicenseKeyDto(
        String id,
        String batchId,
        String maskedCode,
        String status,
        String activatedByUserId,
        Instant activatedAt,
        Instant expiresAt,
        Instant createdAt
) {
    public static LicenseKeyDto from(LicenseKey k) {
        return new LicenseKeyDto(
                k.getId(), k.getBatchId(), k.getMaskedCode(), lower(k.getStatus()),
                k.getActivatedByUserId(),
                k.getActivatedAt(), k.getExpiresAt(), k.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
