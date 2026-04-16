package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Platform end-user account (平台用户账号).
 * Users are registered by activating a license key.
 * Admin staff accounts are stored in AdminUser instead.
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

    @Enumerated(EnumType.STRING)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    private long credits;

    private boolean emailVerified;
    private boolean phoneVerified;
    private String langPreference;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant lastLoginAt;

    /**
     * Platform user roles — reflects the user's identity in the AI artist ecosystem.
     * AI_SINGER:        AI 歌手 — virtual singer
     * AI_ARTIST:        AI 艺人 — AI artist (broader creative role)
     * ECONOMIC_COMPANY: 经纪公司 — talent/economic company managing AI artists
     */
    public enum UserRole {
        AI_SINGER,
        AI_ARTIST,
        ECONOMIC_COMPANY
    }

    public enum UserStatus {
        ACTIVE, SUSPENDED, DELETED
    }
}
