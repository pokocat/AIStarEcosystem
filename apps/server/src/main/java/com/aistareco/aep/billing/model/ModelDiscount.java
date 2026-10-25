package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_model_discounts")
public class ModelDiscount {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String targetKey;
    @Column(nullable=false,columnDefinition="TEXT") private String targetJson;
    @Column(nullable=false,length=128) private String name;
    @Column(nullable=false,length=16) private String audience;
    @Column(length=64) private String audienceId;
    @Column(nullable=false,precision=10,scale=6) private BigDecimal factor;
    private boolean allowGrants;
    private boolean active;
    private Instant startsAt;
    private Instant expiresAt;
    @Version private long version;
    @Column(length=64) private String updatedBy;
    private Instant updatedAt;
}
