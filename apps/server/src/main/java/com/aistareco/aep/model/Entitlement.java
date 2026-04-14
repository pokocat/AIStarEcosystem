package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_entitlements")
public class Entitlement {

    @Id
    private String id;

    private String tenantId;
    private String productId;
    private String planId;

    @Enumerated(EnumType.STRING)
    private EntitlementType entitlementType;

    private String featureCode;
    private String value;
    private Instant validFrom;
    private Instant validTo;

    @Enumerated(EnumType.STRING)
    private EntitlementStatus status;

    private Instant createdAt;

    public enum EntitlementType {
        FEATURE_ACCESS, SEAT_LIMIT, QUOTA_LIMIT, MONTHLY_CREDIT,
        ADDON, SINGER_SLOT, NFT_MINT_QUOTA, DISTRIBUTION_TIER
    }

    public enum EntitlementStatus {
        ACTIVE, EXPIRED, REVOKED
    }
}
