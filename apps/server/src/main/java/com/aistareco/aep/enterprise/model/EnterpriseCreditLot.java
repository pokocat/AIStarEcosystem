package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

/** Cash-backed enterprise credits retain their original recharge order through transfers and holds. */
@Data @Entity
@Table(name="aep_enterprise_credit_lots",uniqueConstraints=@UniqueConstraint(name="uk_enterprise_credit_lot",columnNames={"recharge_order_id","wallet_id"}),
        indexes=@Index(name="idx_enterprise_lot_wallet",columnList="wallet_id,created_at,id"))
public class EnterpriseCreditLot {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String enterpriseId;
    @Column(nullable=false,length=64) private String rechargeOrderId;
    @Column(nullable=false,length=64) private String walletId;
    private long available;
    private long frozen;
    @Column(nullable=false) private Instant createdAt;
}
