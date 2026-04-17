package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * License batch. Each key in the batch grants the same initial credit amount when activated.
 * Plans / subscriptions removed entirely (see /product_spec.md §0.1, §2.1).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_license_batches")
public class LicenseBatch {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String batchNo;

    /** Marketing display name, e.g. "种子用户包". */
    @Column(nullable = false)
    private String name;

    /**
     * Tenant that issued / distributes this batch.
     * Activating a key adds the user as a member of this tenant — used for issuer
     * activation analytics.
     */
    @Column(nullable = false)
    private String issuerTenantId;

    /** One-time credits granted on activation. Same value for every key in the batch. */
    private long initialCreditGrant;

    private int totalCount;
    private int activatedCount;

    private Instant validFrom;
    private Instant validTo;

    @Enumerated(EnumType.STRING)
    private LicenseBatchStatus status;

    private Instant createdAt;

    public enum LicenseBatchStatus {
        ACTIVE, EXHAUSTED, REVOKED, EXPIRED
    }
}
