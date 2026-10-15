package com.aistareco.aep.enterprise.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter @Setter @NoArgsConstructor
@Entity @Table(name="aep_enterprise_points_transfers")
public class EnterprisePointsTransfer {
    @Id @Column(length=64)
    private String id;
    @Column(nullable=false,length=64)
    private String batchId;
    @Column(nullable=false,length=64)
    private String memberId;
    @Column(nullable=false,length=64)
    private String fromWalletId;
    @Column(nullable=false,length=64)
    private String toWalletId;
    @Column(nullable=false)
    private long amount;
    @Column(nullable=false)
    private long fromGift;
    @Column(nullable=false)
    private long fromLicense;
    @Column(nullable=false)
    private long fromRecharge;
    @Column(nullable=false,length=64)
    private String outLedgerId;
    @Column(nullable=false,length=64)
    private String inLedgerId;
}
