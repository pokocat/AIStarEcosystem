package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_recharge_records")
public class RechargeRecord {

    @Id
    private String id;

    /** Maps to DTO field "date". */
    private LocalDate recordDate;

    /** Maps to DTO field "desc". */
    @Column(columnDefinition = "LONGTEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RechargeSource source;

    private long creditsAdded;

    private long priceCents;

    private String userId;

    public enum RechargeSource {
        CREDIT_PACK, LICENSE_REDEEM, PROMO_GIFT
    }
}
