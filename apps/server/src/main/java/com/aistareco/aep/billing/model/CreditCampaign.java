package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_credit_campaigns")
public class CreditCampaign {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=128) private String name;
    @Column(nullable=false,columnDefinition="TEXT") private String targetsJson;
    @Column(nullable=false,length=16) private String resourceUnit;
    private long totalIssueLimit;
    private long perWalletIssueLimit;
    private long issued;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal resourceLimit = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal resourceReserved = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal resourceUsed = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal perWalletDailyResourceLimit = BigDecimal.ZERO;
    private int maxConcurrentPerWallet;
    private boolean active;
    private Instant startsAt;
    private Instant expiresAt;
    @Version private long version;
    @Column(length=64) private String updatedBy;
    private Instant updatedAt;
}
