package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

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
    private String tenantId;

    /**
     * The platform user who triggered this entry (user-level attribution).
     * Enables per-user consumption statistics within a tenant.
     * Null for system-initiated entries (e.g., plan credit topups).
     */
    private String userId;

    @Enumerated(EnumType.STRING)
    private LedgerEntryType entryType;

    private long amount;
    private long balanceAfter;
    private String description;
    private String referenceId;
    private String referenceType;
    private Instant createdAt;

    public enum LedgerEntryType {
        CREDIT, DEBIT, FREEZE, UNFREEZE, EXPIRE
    }
}
