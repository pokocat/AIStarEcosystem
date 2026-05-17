package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 业务侧 LLM gateway 调用凭证。
 *
 * 完整 plaintext key 形态：`sk-aep-<22位 base62>`。
 * 仅在创建瞬间返回明文一次；DB 只存：
 *   - keyPrefix：前 12 位（含 `sk-aep-`），用于列表展示 + 验证时索引检索
 *   - keyHash：bcrypt 哈希
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "llm_api_keys", indexes = {
        @Index(name = "idx_llm_api_key_prefix", columnList = "key_prefix"),
        @Index(name = "idx_llm_api_key_user", columnList = "user_id")
})
public class LlmApiKey {

    @Id
    private String id;

    @Column(name = "key_prefix", nullable = false, length = 16)
    private String keyPrefix;

    @Column(name = "key_hash", nullable = false, length = 80)
    private String keyHash;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    @Builder.Default
    private boolean enabled = true;

    /** 累计 token 消耗，由 internal /usage 累加 */
    @Builder.Default
    private long totalTokens = 0L;

    @Builder.Default
    private long totalCalls = 0L;

    private Instant lastUsedAt;
    private Instant revokedAt;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
