package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 大模型 provider 配置（v0.5 §D8 新增）。
 *
 * apiKey **必须**对称加密落库（AepCryptoUtil.encrypt）。
 * 服务在 invokeChat 时一次解密，**不在响应中明文返回**。
 *
 * 前端真值源：apps/web/src/types/celebrity-zone.ts AiModelProvider（v0.5 新增）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_model_providers")
public class AiModelProvider {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, name = "provider_type")
    private AiModelProviderType providerType;

    @Column(nullable = false, length = 512)
    private String baseUrl;

    /** apiKey 密文（base64(iv || ciphertext || tag)）。 */
    @Column(nullable = false, name = "api_key_encrypted", length = 1024)
    private String apiKeyEncrypted;

    /** Azure OpenAI 用；其他 provider 留空。 */
    private String apiVersion;

    private String defaultModel;

    /** 可选模型列表 JSON：[{ id, label, contextWindow, supportsVision }]。 */
    @Column(name = "models_json", columnDefinition = "TEXT")
    private String modelsJson;

    /** 用途分类（comma-separated 存储；List<AiModelPurpose> 走自定义 converter）。 */
    @Column(name = "purposes", columnDefinition = "TEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> purposes = new ArrayList<>();

    @Builder.Default
    private Integer priority = 100;

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
