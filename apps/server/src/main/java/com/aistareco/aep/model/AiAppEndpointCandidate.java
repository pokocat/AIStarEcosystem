package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

/**
 * AI 应用候选端点（D-11 新增）：把「一用途一端点」（{@link AiAppBinding}）升级为
 * 「一用途 N 候选端点（带 capability 元数据）」。{@link AiAppBinding} 保持不变，语义降格为
 * 「该用途的<b>默认</b>端点」；本表每行是「purpose × endpoint」交点，承载该端点在该用途下的
 * 能力画像（可用于 C-3 参考裁剪 / C-5 质检路由）与可选单价 override。
 *
 * <p>{@code resolveEndpoint(purpose)} 行为零变化（仍读 AiAppBinding）；仅 {@code resolveEndpoint(purpose,
 * endpointId)} 走本表白名单校验。为何不把 capability 挂到 {@link AiModelEndpoint}：capability 是
 * 「端点在某用途下」的能力（同一 OpenAI 兼容端点用于 IMAGE 与 VIDEO 时能力不同），挂在交点语义更准，
 * 且新表零迁移、不碰热路径实体。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_app_endpoint_candidate",
        uniqueConstraints = @UniqueConstraint(columnNames = {"purpose", "endpoint_id"}),
        indexes = @Index(name = "idx_aaec_purpose", columnList = "purpose"))
public class AiAppEndpointCandidate {

    @Id
    @Column(length = 40)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(length = 40, nullable = false)
    private AiModelPurpose purpose;

    @Column(name = "endpoint_id", nullable = false)
    private String endpointId;

    /** 展示排序；小在前。默认端点（= AiAppBinding.endpointId）由 seeder 置 0 → UI 置顶。 */
    @ColumnDefault("100")
    @Builder.Default
    @Column(nullable = false)
    private int sortOrder = 100;

    @ColumnDefault("true")
    @Builder.Default
    @Column(nullable = false)
    private boolean enabled = true;

    // ── capability 元数据（C-3 参考装配 / C-5 路由读取；null=未知 → 消费方按 legacy 兼容默认）──
    /** 最多可送参考图张数；null=未知，装配按 legacy 兼容默认 6（v0.97 前端既有上限）。 */
    @Column(name = "max_ref_images")
    private Integer maxRefImages;

    /** 是否支持首+尾帧关键帧插值；null=未知，按 C-1 协议关键字静态判定兜底（agnes 仅首帧，其余支持）。 */
    @Column(name = "supports_first_last_frame")
    private Boolean supportsFirstLastFrame;

    /** 是否支持主体（subject）参考；null=未知，按 false（无静态判定依据）。 */
    @Column(name = "supports_subject_reference")
    private Boolean supportsSubjectReference;

    /** 单条视频最大时长（秒）；null=未知。 */
    @Column(name = "max_duration_sec")
    private Integer maxDurationSec;

    /** 本端点在该用途下的积分单价 override（null=用用途默认单价，如 drama.credit.clip / drama.credit.frame）。 */
    @Column(name = "credit_cost_override")
    private Long creditCostOverride;

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
