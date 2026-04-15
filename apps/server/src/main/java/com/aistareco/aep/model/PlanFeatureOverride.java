package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_plan_feature_overrides")
public class PlanFeatureOverride {

    @Id
    private String id;

    @Column(nullable = false)
    private String planId;

    @Column(nullable = false)
    private String configKey;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String overrideValue;

    private boolean isActive;
    private Instant createdAt;
}
