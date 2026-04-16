package com.aistareco.aep.dto;

import com.aistareco.aep.model.LedgerEntry;

import java.time.Instant;
import java.util.Locale;

public record LedgerEntryDto(
        String id,
        String walletId,
        String tenantId,
        String entryType,
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
                lower(e.getEntryType()), e.getAmount(), e.getBalanceAfter(),
                e.getDescription(), e.getReferenceId(), e.getReferenceType(),
                e.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
