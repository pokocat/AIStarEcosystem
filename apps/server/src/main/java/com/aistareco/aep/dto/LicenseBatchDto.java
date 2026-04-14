package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseBatch;

import java.time.Instant;

public record LicenseBatchDto(
        String id,
        String batchNo,
        String productId,
        String planId,
        LicenseBatch.LicenseType licenseType,
        Integer durationDays,
        long creditDelta,
        LicenseBatch.SettlementMode settlementMode,
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
                b.getLicenseType(), b.getDurationDays(), b.getCreditDelta(),
                b.getSettlementMode(), b.getTotalCount(), b.getActivatedCount(),
                b.getChannelPartnerId(), b.getValidFrom(), b.getValidTo(), b.getCreatedAt()
        );
    }
}
