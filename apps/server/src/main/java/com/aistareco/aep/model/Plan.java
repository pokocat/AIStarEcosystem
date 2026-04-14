package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_plans")
public class Plan {

    @Id
    private String id;

    private String productId;
    private String code;
    private String name;
    private long monthlyPriceCents;
    private long annualPriceCents;
    private boolean enabled;
    private Instant createdAt;
}
