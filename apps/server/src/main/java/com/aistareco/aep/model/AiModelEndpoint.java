package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

/**
 * AI 模型接入端点（v0.41 统一：原 {@code AiModelProvider} 演化而来）。
 *
 * 一行 = 一个**固定的可调用模型** = {上游密钥 + 单个模型 + 地址}：
 *   - 上游：{@link #providerType} + {@link #baseUrl} + {@link #upstreamApiKeyEncrypted}(密文) + {@link #model}(单)
 *   - 内部 AI 应用经 {@code ai_app_binding} 路由到本端点调用（v0.81 移除对外 API Token）。
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

    /** 业务别名：业务代码 / 外部 API 可传 default-chat 这类稳定名，实际落到 model。 */
    @Column(name = "model_alias", length = 80)
    private String modelAlias;

    /** 默认 temperature。null 表示由 prompt 参数或调用方决定。 */
    @Column(name = "default_temperature")
    private Double defaultTemperature;

    /** 默认 max_tokens。null 表示由 prompt 参数或调用方决定。 */
    @Column(name = "default_max_tokens")
    private Integer defaultMaxTokens;

    /** 默认 top_p。null 表示由调用方决定。 */
    @Column(name = "default_top_p")
    private Double defaultTopP;

    /** 每分钟请求数限制；为空表示不限制。 */
    @Column(name = "rpm_limit")
    private Integer rpmLimit;

    /** 每分钟 token 估算限制；为空表示不限制。 */
    @Column(name = "tpm_limit")
    private Integer tpmLimit;

    /** 每日 token 配额；为空表示不限制。按 Asia/Shanghai 自然日统计。 */
    @Column(name = "daily_token_quota")
    private Long dailyTokenQuota;

    /** 每日成本配额，单位人民币微元；为空表示不限制。按 Asia/Shanghai 自然日统计。 */
    @Column(name = "daily_cost_quota_micros")
    private Long dailyCostQuotaMicros;

    /** 失败率告警阈值百分比；为空使用全局默认。 */
    @Column(name = "alert_failure_rate_pct")
    private Integer alertFailureRatePct;

    /** 可选模型列表 JSON：[{ id, label, contextWindow, supportsVision }]，仅做发现挑选用。 */
    @Column(name = "models_json", columnDefinition = "LONGTEXT")
    private String modelsJson;

    /** 计费归属用户（钱包）。**可空 = 平台级端点，usage 仅累计不扣钱包**。 */
    @Column(name = "owner_user_id")
    private String ownerUserId;

    /** 成本估算口径；null = 自动按用途推断（文本 token / 图片按次 / 视频按秒）。 */
    @Enumerated(EnumType.STRING)
    @Column(name = "billing_mode", length = 32)
    private AiModelBillingMode billingMode;

    /** 输入 token 单价，单位：人民币微元 / 1K Token。0 = 未配置成本价。 */
    @ColumnDefault("0")
    @Builder.Default
    @Column(name = "prompt_token_price_micros")
    private long promptTokenPriceMicros = 0L;

    /** 输出 token 单价，单位：人民币微元 / 1K Token。0 = 未配置成本价。 */
    @ColumnDefault("0")
    @Builder.Default
    @Column(name = "completion_token_price_micros")
    private long completionTokenPriceMicros = 0L;

    /** 按次/按秒计费的单位价格，单位：人民币微元 / 次 或 / 秒。 */
    @ColumnDefault("0")
    @Builder.Default
    @Column(name = "unit_price_micros")
    private long unitPriceMicros = 0L;

    /** 累计 token 消耗（内部 AI 应用调用累计）。 */
    @ColumnDefault("0")
    @Builder.Default
    private long totalTokens = 0L;

    /** 累计按次用量（图片张数 / 视频条数等），仅成功调用累计。 */
    @ColumnDefault("0")
    @Builder.Default
    @Column(name = "total_billable_units")
    private long totalBillableUnits = 0L;

    /** 累计按秒用量（视频生成时长），仅成功调用累计。 */
    @ColumnDefault("0")
    @Builder.Default
    @Column(name = "total_billable_seconds")
    private long totalBillableSeconds = 0L;

    @ColumnDefault("0")
    @Builder.Default
    private long totalCalls = 0L;

    private Instant lastUsedAt;

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
