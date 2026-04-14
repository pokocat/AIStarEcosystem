package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

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

    private String productId;
    private String planId;

    @Enumerated(EnumType.STRING)
    private LicenseType licenseType;

    private Integer durationDays;
    private long creditDelta;

    @Enumerated(EnumType.STRING)
    private SettlementMode settlementMode;

    private int totalCount;
    private int activatedCount;
    private String channelPartnerId;
    private Instant validFrom;
    private Instant validTo;
    private Instant createdAt;

    public enum LicenseType {
        PLAN_ACTIVATION, CREDIT_PACK, SEAT_EXPANSION, ADDON
    }

    public enum SettlementMode {
        PREPAID, ON_ACTIVATION
    }
}
