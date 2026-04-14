package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_tenants")
public class Tenant {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    private TenantType type;

    @Enumerated(EnumType.STRING)
    private TenantStatus status;

    private String ownerUserId;
    private Instant createdAt;
    private Instant updatedAt;

    public enum TenantType {
        PERSONAL, ORGANIZATION, CHANNEL
    }

    public enum TenantStatus {
        ACTIVE, SUSPENDED, DELETED
    }
}
