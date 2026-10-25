package com.aistareco.aep.billing.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
@Entity
@Table(name="aep_model_prices")
public class ModelPrice {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,unique=true,length=64) private String targetKey;
    @Column(nullable=false,columnDefinition="TEXT") private String targetJson;
    @Column(nullable=false,length=128) private String name;
    @Column(nullable=false,precision=25,scale=9) private BigDecimal unitPrice;
    @Column(precision=25,scale=9) private BigDecimal outputUnitPrice;
    private boolean active;
    @Version private long version;
    @Column(length=64) private String updatedBy;
    private Instant updatedAt;
}
