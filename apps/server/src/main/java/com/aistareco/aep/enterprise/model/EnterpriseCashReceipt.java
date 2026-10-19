package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.Instant;

/** Global receipt identity is reserved in the same transaction as posting/refunding. */
@Data @Entity @Table(name="aep_enterprise_cash_receipts")
public class EnterpriseCashReceipt {
    @Id @Column(length=72) private String id;
    @Column(nullable=false,length=64) private String orderId;
    @Column(nullable=false,length=16) private String direction;
    @Column(nullable=false,length=256) private String receiptReference;
    @Column(nullable=false) private Instant createdAt;
}
