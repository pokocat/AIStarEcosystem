package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Per-user credit wallet (1:1 with AepUser).
 * Schema/contract aligned with /product_spec.md §1.3.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_wallets")
public class Wallet {

    @Id
    private String id;

    /** FK → aep_users.id (1:1). */
    @Column(unique = true, nullable = false)
    private String userId;

    /** Aggregate balance = licenseBalance + rechargeBalance + giftBalance. Never negative. */
    private long totalBalance;

    /** Cumulative credits granted via License activations. Never expires. */
    private long licenseBalance;

    /** Cumulative credits added via paid recharges. Never expires. */
    private long rechargeBalance;

    /** Cumulative credits granted via promo / platform gifts. Never expires. */
    private long giftBalance;

    /** Pending credits (in-flight settlements waiting to land). Not part of totalBalance. */
    private long pendingBalance;

    private Instant createdAt;
    private Instant updatedAt;
}
