package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_credit_grants", uniqueConstraints=@UniqueConstraint(name="uk_scoped_grant_source",columnNames={"source","source_reference"}))
public class CreditGrant {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String walletId;
    @Column(nullable=false,length=64) private String campaignId;
    private long amount;
    private long available;
    private long frozen;
    private long spent;
    private long expired;
    @Column(nullable=false,length=64) private String source;
    @Column(nullable=false,length=128) private String sourceReference;
    @Column(nullable=false,length=512) private String reason;
    @Column(nullable=false,length=64) private String createdBy;
    private Instant expiresAt;
    private Instant createdAt;
}
