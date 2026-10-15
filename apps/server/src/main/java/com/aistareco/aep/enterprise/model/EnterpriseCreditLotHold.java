package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.Data;

@Data @Entity
@Table(name="aep_enterprise_credit_lot_holds",uniqueConstraints=@UniqueConstraint(name="uk_enterprise_lot_hold",columnNames={"hold_id","lot_id"}))
public class EnterpriseCreditLotHold {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String holdId;
    @Column(nullable=false,length=64) private String lotId;
    private long originalAmount;
    private long frozen;
    private long releasedAmount;
}
