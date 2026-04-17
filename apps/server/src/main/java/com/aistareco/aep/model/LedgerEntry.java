package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Immutable credit transaction log per wallet.
 * Schema/contract aligned with /product_spec.md §1.4.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_ledger_entries")
public class LedgerEntry {

    @Id
    private String id;

    private String walletId;

    /** Wallet owner — denormalized for per-user queries. */
    private String userId;

    @Enumerated(EnumType.STRING)
    private LedgerEntryType entryType;

    /** Signed: positive = credit, negative = debit. */
    private long amount;
    private long balanceAfter;
    private String description;
    private String referenceId;
    private String referenceType;
    private Instant createdAt;

    public enum LedgerEntryType {
        LICENSE_GRANT,
        RECHARGE,
        REFUND,
        INCOME,
        GIFT,
        SPEND,
        WITHDRAW,
        FREEZE,
        UNFREEZE,
        ADJUST
    }
}
