package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseBatch;

import java.time.Instant;
import java.util.Locale;

public record LicenseBatchDto(
        String id,
        String batchNo,
        String name,
        String issuerTenantId,
        long initialCreditGrant,
        int totalCount,
        int activatedCount,
        Instant validFrom,
        Instant validTo,
        String status,
        Instant createdAt
) {
    public static LicenseBatchDto from(LicenseBatch b) {
        return new LicenseBatchDto(
                b.getId(), b.getBatchNo(), b.getName(),
                b.getIssuerTenantId(),
                b.getInitialCreditGrant(),
                b.getTotalCount(), b.getActivatedCount(),
                b.getValidFrom(), b.getValidTo(),
                lower(b.getStatus()), b.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
