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
        @Index(name = "idx_aiusage_provider", columnList = "provider_id"),
        @Index(name = "idx_aiusage_user", columnList = "user_id"),
        @Index(name = "idx_aiusage_tenant", columnList = "tenant_id"),
        @Index(name = "idx_aiusage_app", columnList = "app_code")
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

    /** 真实调用人。可空：平台级端点、历史数据或无登录上下文。 */
    @Column(name = "user_id", length = 64)
    private String userId;

    /** 用户所属租户快照。可空：用户无 membership、平台级调用或历史数据。 */
    @Column(name = "tenant_id", length = 64)
    private String tenantId;

    /** 来源应用短码：music / drama / celebrity / aiavatar / star / celebrity-mp / admin / external-api。 */
    @Column(name = "app_code", length = 32)
    private String appCode;

    /** 平台生成或上游透传的请求追踪号，用于跨日志、账本、调用流水排障。 */
    @Column(name = "request_id", length = 96)
    private String requestId;

    /** 上游服务商返回的调用 id。可空：部分国产兼容端点不返回。 */
    @Column(name = "upstream_id", length = 128)
    private String upstreamId;

    /** 本次上游调用总耗时，毫秒。 */
    @Column(name = "latency_ms")
    private Long latencyMs;

    /** 平台归一后的错误码，如 HTTP_429、SocketTimeoutException。成功调用为空。 */
    @Column(name = "error_code", length = 64)
    private String errorCode;

    /** 标准失败原因分类。成功调用为空。 */
    @Enumerated(EnumType.STRING)
    @Column(name = "error_category", length = 32)
    private AiModelFailureCategory errorCategory;

    /** 脱敏后的错误摘要，仅用于 admin 排障列表。 */
    @Column(name = "error_message", length = 512)
    private String errorMessage;

    /** 发给模型的最终请求体 JSON。仅保存脱敏/截断后的文本，供 admin 排障/重放。 */
    @Lob
    @Column(name = "request_body_json", columnDefinition = "LONGTEXT")
    private String requestBodyJson;

    /** 上游原始响应体 JSON 或 SSE 摘要。仅保存截断后的文本，供 admin 排障/质量评估。 */
    @Lob
    @Column(name = "response_body_json", columnDefinition = "LONGTEXT")
    private String responseBodyJson;

    /** 本次调用估算成本，单位：人民币微元。保存快照，避免单价变化影响历史统计。 */
    @Column(name = "cost_micros")
    private Long costMicros;

    /** 从失败明细点击重放时，指向原始 usage record id。 */
    @Column(name = "replay_of_record_id", length = 64)
    private String replayOfRecordId;

    /** 人工或自动质量评分，0-100。 */
    @Column(name = "quality_score")
    private Integer qualityScore;

    @Column(name = "quality_label", length = 32)
    private String qualityLabel;

    @Column(name = "quality_note", length = 512)
    private String qualityNote;

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
