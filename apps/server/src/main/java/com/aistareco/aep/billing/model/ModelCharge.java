package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_model_charges")
public class ModelCharge {
    @Id @Column(length=64) private String holdId;
    @Column(name="parent_hold_id",length=64) private String parentHoldId;
    @Column(nullable=false,columnDefinition="TEXT") private String targetJson;
    @Column(nullable=false,columnDefinition="TEXT") private String snapshotJson;
    private long baseCredits;
    private long standardCredits;
    private long payableCredits;
    private long scopedCredits;
    private long walletCredits;
    private long settledBaseCredits;
    private long settledPayableCredits;
    private long settledScopedCredits;
    private long settledWalletCredits;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal settledQuantity = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal settledOutputQuantity = BigDecimal.ZERO;
    private boolean freeOnly;
    private Instant createdAt;
}
