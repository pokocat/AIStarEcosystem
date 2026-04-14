package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_license_keys")
public class LicenseKey {

    @Id
    private String id;

    private String batchId;

    @Column(nullable = false)
    private String codeHash;

    private String maskedCode;

    @Enumerated(EnumType.STRING)
    private LicenseKeyStatus status;

    private String activatedByUserId;
    private String activatedTenantId;
    private Instant activatedAt;
    private Instant expiresAt;
    private Instant createdAt;

    public enum LicenseKeyStatus {
        CREATED, ALLOCATED, SOLD, ACTIVATED, EXPIRED, REVOKED
    }
}
