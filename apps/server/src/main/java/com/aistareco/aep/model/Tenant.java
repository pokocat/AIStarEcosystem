package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Tenant — license-issuance attribution container.
 * A Tenant groups users that activated keys from the same issuer (机构 / 渠道).
 * Used for activation analytics; not for billing/wallet (wallets live on AepUser).
 *
 * Schema/contract aligned with /product_spec.md §1.5.
 */
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
    private TenantKind kind;

    @Enumerated(EnumType.STRING)
    private TenantStatus status;

    private Instant createdAt;
    private Instant updatedAt;

    public enum TenantKind {
        PLATFORM, PERSONAL, ORGANIZATION
    }

    public enum TenantStatus {
        ACTIVE, SUSPENDED, DELETED
    }
}
