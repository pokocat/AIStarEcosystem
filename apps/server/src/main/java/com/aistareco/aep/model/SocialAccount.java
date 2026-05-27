package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 用户绑定的第三方社交平台账号 (sau 集成)。
 *
 * Cookie / Playwright storage_state 以 AES-256-GCM (AepCryptoUtil) 加密后存
 * storageStateEncrypted (Base64 字符串)。明文 storage_state 永不持久化到磁盘，
 * 也永不出现在响应 DTO 中。
 *
 * 唯一索引 (user_id, platform, account_name) 保证同一用户同平台账号别名唯一。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "aep_social_accounts",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_social_user_platform_name",
        columnNames = {"user_id", "platform", "account_name"}
    ),
    indexes = {
        @Index(name = "idx_social_user_status", columnList = "user_id, status"),
        @Index(name = "idx_social_user_bound", columnList = "user_id, bound_at")
    }
)
public class SocialAccount {

    @Id
    private String id;

    /** FK → aep_users.id */
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SocialPlatform platform;

    /** 用户自取的账号别名，例如 "公司主号-抖音" */
    @Column(name = "account_name", nullable = false, length = 128)
    private String accountName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SocialAccountStatus status;

    /** 扫码登录后从平台拿到的昵称 */
    @Column(name = "display_name", length = 128)
    private String displayName;

    /** 平台侧账号号 / handle，例如抖音号。抓不到时为空。 */
    @Column(name = "platform_account_id", length = 128)
    private String platformAccountId;

    @Column(name = "avatar_url", length = 1024)
    private String avatarUrl;

    /**
     * Playwright storage_state JSON 的 AES-256-GCM 密文 (Base64)。
     * 解密由 SocialAccountSecretService.decryptStorageState() 负责，
     * 明文仅在 startJob / verify 等方法局部变量中存活，方法返回后 GC。
     *
     * TEXT 列；storage_state JSON 通常 1-30 KB。
     */
    @Column(name = "storage_state_encrypted", columnDefinition = "LONGTEXT")
    private String storageStateEncrypted;

    @Column(name = "bound_at", nullable = false)
    private Instant boundAt;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (boundAt == null) boundAt = now;
        if (status == null) status = SocialAccountStatus.PENDING;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
