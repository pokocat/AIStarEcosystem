package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 大模型调用用量流水（v0.41 新增）。
 *
 * 每次成功的 {@code /chat/completions} 调用落一行，记录服务商 / 模型 / 用途 + 该次消耗的
 * token（prompt / completion / total，来自响应里的 usage 字段）。
 *
 * 这是「自建用量统计」的真值源：各大模型厂商没有统一的用量查询协议（OpenAI 用量需 Admin key、
 * 火山/阿里走独立签名的计费 OpenAPI），但每次响应都会带 usage，因此本表对所有 provider 通用。
 *
 * 不可变：只追加，不更新。聚合查询见 {@link com.aistareco.aep.service.AiModelUsageService}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_model_usage_record", indexes = {
        @Index(name = "idx_aiusage_created", columnList = "created_at"),
        @Index(name = "idx_aiusage_provider", columnList = "provider_id")
})
public class AiModelUsageRecord {

    @Id
    private String id;

    @Column(name = "provider_id", length = 64)
    private String providerId;

    @Column(name = "provider_name")
    private String providerName;

    private String model;

    /** 用途 wire（AiModelPurpose.name()）。 */
    private String purpose;

    @Column(name = "prompt_tokens")
    private Long promptTokens;

    @Column(name = "completion_tokens")
    private Long completionTokens;

    @Column(name = "total_tokens")
    private Long totalTokens;

    @Builder.Default
    private boolean success = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
