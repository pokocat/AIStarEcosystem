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

    /**
     * v0.47：用 keys 表派生的真实计数覆盖 batch 的 denormalized 列。
     * 修复历史 drift：activatedCount 只增不减（revoke 未减）+ 老数据手动改过 → 出现
     * activatedCount &gt; totalCount 的违反不变量场景。listBatches / findBatchById
     * 应改走此入口。
     */
    public static LicenseBatchDto fromDerived(LicenseBatch b, long totalCount, long activatedCount) {
        int safeTotal = (int) Math.max(0, Math.min(totalCount, Integer.MAX_VALUE));
        int safeActivated = (int) Math.max(0, Math.min(activatedCount, Integer.MAX_VALUE));
        return new LicenseBatchDto(
                b.getId(), b.getBatchNo(), b.getName(),
                b.getIssuerTenantId(),
                b.getSellingChannelId(),
                b.getTier(),
                b.getInitialCreditGrant(),
                safeTotal, safeActivated,
                b.getValidFrom(), b.getValidTo(),
                lower(b.getStatus()), b.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
