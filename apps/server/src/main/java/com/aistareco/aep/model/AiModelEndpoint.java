package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

/**
 * AI 模型接入端点（v0.41 统一：原 {@code AiModelProvider} 演化而来）。
 *
 * 一行 = 一个**固定的可调用模型** = {上游密钥 + 单个模型 + 地址}，且**自带一个网关 Key**：
 *   - 上游：{@link #providerType} + {@link #baseUrl} + {@link #upstreamApiKeyEncrypted}(密文) + {@link #model}(单)
 *   - 网关 Key：{@link #keyPrefix} + {@link #keyHash}(bcrypt) —— 折叠自旧 {@code LlmApiKey}；
 *     内部 AI 应用经 {@code ai_app_binding} 路由到本端点，外部业务方持 {@code sk-aep-*} 经 llm-gateway 调用本端点并计费。
 *
 * 表名保留 {@code ai_model_providers}（JPA ddl-auto=update 重命名表会孤立旧数据）。
 * {@code api_key_encrypted} / {@code default_model} 两个物理列复用，零数据搬迁；
 * 旧的 {@code purposes} / {@code priority} 列在 DB 残留但实体不再映射（迁移 seeder 在弃用前读一次）。
 *
 * 上游 apiKey **必须**对称加密落库（{@code AepCryptoUtil.encrypt}），调用时一次解密，**不在响应中明文返回**。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_model_providers")
public class AiModelEndpoint {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "provider_type")
    private AiModelProviderType providerType;

    @Column(nullable = false, length = 512)
    private String baseUrl;

    /** 上游 apiKey 密文（base64(iv || ciphertext || tag)）。复用旧列 api_key_encrypted。 */
    @Column(nullable = false, name = "api_key_encrypted", length = 1024)
    private String upstreamApiKeyEncrypted;

    /** Azure OpenAI 用；其他端点留空。 */
    private String apiVersion;

    /** 固定的单个模型 id（复用旧列 default_model）。 */
    @Column(name = "default_model")
    private String model;

    /** 可选模型列表 JSON：[{ id, label, contextWindow, supportsVision }]——仅做发现挑选用。 */
    @Column(name = "models_json", columnDefinition = "LONGTEXT")
    private String modelsJson;

    // ── 内嵌网关 Key（折叠自 LlmApiKey；按需铸造，可空） ──────────────────────────

    /** sk-aep-XXXXX 前 12 位（明文 prefix），用于列表展示 + 验证索引检索。未铸造时为 null。 */
    @Column(name = "key_prefix", length = 16)
    private String keyPrefix;

    /** 网关 Key 的 bcrypt 哈希。未铸造时为 null。 */
    @Column(name = "key_hash", length = 80)
    private String keyHash;

    /** 计费归属用户（钱包）。**可空 = 平台级端点，usage 仅累计不扣钱包**。 */
    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 累计 token 消耗，由 internal /usage 累加。 */
    @ColumnDefault("0")
    @Builder.Default
    private long totalTokens = 0L;

    @ColumnDefault("0")
    @Builder.Default
    private long totalCalls = 0L;

    private Instant lastUsedAt;

    /** 撤销网关 Key（不删端点；撤销后 validate 不再通过）。 */
    @Column(name = "key_revoked_at")
    private Instant keyRevokedAt;

    @ColumnDefault("true")
    @Builder.Default
    private boolean enabled = true;

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
