package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_credit_grant_holds", uniqueConstraints=@UniqueConstraint(name="uk_scoped_grant_hold",columnNames={"hold_id","grant_id"}))
public class CreditGrantHold {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String holdId;
    @Column(nullable=false,length=64) private String grantId;
    private long originalAmount;
    private long frozen;
    private long consumed;
    private long released;
    private int allocationOrder;
}
