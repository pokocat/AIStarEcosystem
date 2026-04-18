package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Platform end-user account (平台用户账号).
 * Users are registered by activating a license key (see LicenseActivationService).
 * Admin staff accounts are stored in AdminUser instead.
 *
 * Schema/contract aligned with /product_spec.md §1.2.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_users")
public class AepUser {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    private String passwordHash;
    private String email;
    private String phone;
    private String displayName;
    private String avatarUrl;
    private String walletAddress;

    @Column(length = 1024)
    private String bio;

    /**
     * Account kind. Drives whether the studio console is available.
     * personal = consumer / fan; studio = operator running a Studio profile.
     */
    @Enumerated(EnumType.STRING)
    private AccountKind kind;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    private boolean emailVerified;
    private boolean phoneVerified;
    private String langPreference;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    public enum AccountKind {
        PERSONAL, STUDIO
    }

    public enum UserStatus {
        ACTIVE, SUSPENDED, DELETED
    }
}
