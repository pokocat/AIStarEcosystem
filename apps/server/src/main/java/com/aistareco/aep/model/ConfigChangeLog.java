package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_config_change_logs")
public class ConfigChangeLog {

    @Id
    private String id;

    @Column(nullable = false)
    private String configKey;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String oldValue;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String newValue;

    @Column(nullable = false)
    private String changedBy;

    @Column(nullable = false)
    private String changedByRole;

    @Column(nullable = false)
    private String changeReason;

    private Instant effectiveAt;
    private Instant revertedAt;
    private Instant createdAt;
}
