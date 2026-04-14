package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_wallets")
public class Wallet {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String tenantId;

    private long totalBalance;
    private long giftBalance;
    private long rechargeBalance;
    private long planBalance;
    private Instant createdAt;
    private Instant updatedAt;
}
