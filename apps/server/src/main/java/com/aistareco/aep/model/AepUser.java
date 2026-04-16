package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

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

    @Enumerated(EnumType.STRING)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    private UserPlan plan;

    private long credits;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    private boolean emailVerified;
    private boolean phoneVerified;
    private String langPreference;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    public enum UserRole {
        FAN, PRODUCER, COACH, PLATFORM_OWNER, PLATFORM_OPERATOR, FINANCE_ADMIN, CHANNEL_MANAGER
    }

    public enum UserPlan {
        FREE, PRO, ENTERPRISE
    }

    public enum UserStatus {
        ACTIVE, SUSPENDED, DELETED
    }
}
