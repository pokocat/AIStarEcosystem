package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_feature_configs")
public class FeatureConfig {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String configKey;

    @Column(nullable = false)
    private String configGroup;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ValueType valueType;

    @Column(name = "config_value", columnDefinition = "TEXT", nullable = false)
    private String value;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String defaultValue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Scope scope;

    private String productId;
    private String planId;
    private String tenantId;
    private boolean isActive;
    private boolean isEditableByOperator;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String minValue;
    private String maxValue;
    private String updatedBy;
    private Instant updatedAt;
    private Instant createdAt;

    public enum ValueType {
        INT, FLOAT, BOOL, STRING, JSON
    }

    public enum Scope {
        GLOBAL, PRODUCT, PLAN, TENANT
    }
}
