package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_credit_resource_reservations", uniqueConstraints=@UniqueConstraint(name="uk_scoped_resource_hold",columnNames={"hold_id","campaign_id"}))
public class CreditResourceReservation {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String holdId;
    @Column(nullable=false,length=64) private String campaignId;
    @Column(nullable=false,length=64) private String walletId;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal originalUnits;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal reserved = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal used = BigDecimal.ZERO;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal released = BigDecimal.ZERO;
    private Instant createdAt;
    private Instant dispatchedAt;
    private Instant completedAt;
}
