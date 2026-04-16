package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseBatch;

import java.time.Instant;
import java.util.Locale;

public record LicenseBatchDto(
        String id,
        String batchNo,
        String productId,
        String planId,
        String licenseType,
        Integer durationDays,
        long creditDelta,
        String settlementMode,
        int totalCount,
        int activatedCount,
        String channelPartnerId,
        Instant validFrom,
        Instant validTo,
        Instant createdAt
) {
    public static LicenseBatchDto from(LicenseBatch b) {
        return new LicenseBatchDto(
                b.getId(), b.getBatchNo(), b.getProductId(), b.getPlanId(),
                lower(b.getLicenseType()), b.getDurationDays(), b.getCreditDelta(),
                lower(b.getSettlementMode()), b.getTotalCount(), b.getActivatedCount(),
                b.getChannelPartnerId(), b.getValidFrom(), b.getValidTo(), b.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
