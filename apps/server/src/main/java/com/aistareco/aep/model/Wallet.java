package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Credit wallet: personal (1:1 with AepUser), enterprise, or enterprise member.
 * Schema/contract aligned with /product_spec.md §1.3.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_wallets", uniqueConstraints = @UniqueConstraint(name="uk_wallet_account_key",columnNames="account_key"),
        indexes=@Index(name="idx_wallet_enterprise",columnList="enterprise_id,id"))
public class Wallet {

    @Id
    private String id;

    /** FK → aep_users.id (1:1). */
    @Column(unique = true)
    private String userId;

    @Column(nullable=false,length=32)
    @Builder.Default private String accountType = "personal";
    @Column(nullable=false,length=512)
    private String accountKey;
    @Column(length=64) private String enterpriseId;
    @Column(length=64) private String memberUserId;

    @PrePersist
    void initializeAccount() {
        if (accountType == null) accountType = "personal";
        if ("personal".equals(accountType)) {
            if (userId == null || userId.isBlank() || enterpriseId != null || memberUserId != null)
                throw new IllegalStateException("个人钱包主体无效");
            accountKey = "personal:" + userId;
        } else if ("enterprise".equals(accountType) && enterpriseId != null && userId == null && memberUserId == null) {
            accountKey = "enterprise:" + enterpriseId;
        } else if ("enterprise_member".equals(accountType) && enterpriseId != null && userId == null && memberUserId != null) {
            accountKey = "enterprise_member:" + enterpriseId + ":" + memberUserId;
        } else throw new IllegalStateException("钱包主体无效");
    }

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
