package com.aistareco.aep.dto;

import com.aistareco.aep.model.LedgerEntry;

import java.time.Instant;

public record LedgerEntryDto(
        String id,
        String walletId,
        String tenantId,
        LedgerEntry.LedgerEntryType entryType,
        long amount,
        long balanceAfter,
        String description,
        String referenceId,
        String referenceType,
        Instant createdAt
) {
    public static LedgerEntryDto from(LedgerEntry e) {
        return new LedgerEntryDto(
                e.getId(), e.getWalletId(), e.getTenantId(),
                e.getEntryType(), e.getAmount(), e.getBalanceAfter(),
                e.getDescription(), e.getReferenceId(), e.getReferenceType(),
                e.getCreatedAt()
        );
    }
}
