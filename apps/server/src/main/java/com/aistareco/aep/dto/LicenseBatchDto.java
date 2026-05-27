package com.aistareco.aep.dto;

import com.aistareco.aep.model.LicenseBatch;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Locale;

/**
 * v0.36：补 sellingChannelId / tier 字段（修复前后端 drift）。
 * issuerTenantId 保留为 nullable（向后兼容老批次）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LicenseBatchDto(
        String id,
        String batchNo,
        String name,
        String issuerTenantId,
        String sellingChannelId,
        String tier,
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
                b.getSellingChannelId(),
                b.getTier(),
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
