package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Platform staff account (管理员账号).
 * Separated from AepUser which represents platform end-users.
 * Roles: SUPER_ADMIN (超管) | OPERATOR (运营)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "admin_users")
public class AdminUser {

    @Id
    private String id;

    @Column(unique = true, nullable = false)
    private String username;

    private String passwordHash;
    private String email;
    private String displayName;

    @Enumerated(EnumType.STRING)
    private AdminRole role;

    @Enumerated(EnumType.STRING)
    private AdminStatus status;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    public enum AdminRole {
        /** 超管 — full access */
        SUPER_ADMIN,
        /** 运营 — day-to-day operations */
        OPERATOR
    }

    public enum AdminStatus {
        ACTIVE, SUSPENDED
    }
}
