package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Agent 平台 bot 配置（v0.39 新增）。
 *
 * 把「形象锻造」这类挂在 agent 平台（Coze 等）上的会话能力从 env 写死改为后台可配。
 * 一个 sceneKey 对应一个 bot（unique）；token 必须 AES-GCM 加密落库，调用时一次解密。
 *
 * 与 AiModelProvider 的区别：AiModelProvider 是 OpenAI 兼容 /chat/completions 的「裸大模型」；
 * 本表是「agent 平台托管的 bot」（带知识库 / 工作流 / 工具编排），按 sceneKey 绑定到具体业务功能。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "agent_bot_providers",
        uniqueConstraints = @UniqueConstraint(name = "uk_agent_bot_scene", columnNames = "scene_key"))
public class AgentBotProvider {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AgentPlatform platform = AgentPlatform.COZE;

    /** 业务场景键（唯一）。如 appearance-forge；新功能新增一个 scene + 一行配置。 */
    @Column(name = "scene_key", nullable = false, length = 64)
    private String sceneKey;

    @Column(nullable = false, length = 512)
    @Builder.Default
    private String apiBase = "https://api.coze.cn";

    /** 平台访问 token 密文（base64(iv || ciphertext || tag)）。 */
    @Column(name = "token_encrypted", nullable = false, length = 1024)
    private String tokenEncrypted;

    /** Coze bot id（DIFY 时为 app id）。 */
    @Column(name = "bot_id", nullable = false)
    private String botId;

    /** Coze userID 前缀（区分会话归属，便于平台侧风控/统计）。 */
    @Column(name = "user_id_prefix")
    @Builder.Default
    private String userIdPrefix = "aep-producer-";

    @Column(name = "read_timeout_ms")
    @Builder.Default
    private Integer readTimeoutMs = 120000;

    private String description;

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
