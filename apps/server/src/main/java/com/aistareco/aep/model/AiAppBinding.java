package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * AI 应用绑定（v0.41 新增）：把一个「AI 应用」（{@link AiModelPurpose}）固定绑到**一个**
 * {@link AiModelEndpoint}。用途即主键 = 一用途一端点，无优先级兜底链。
 *
 * 运行时 {@code AiModelInvocationService.resolveEndpoint(purpose)} 经本表解析端点；
 * 外部 llm-gateway 走端点自带的网关 Key，不经本表。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "ai_app_binding")
public class AiAppBinding {

    /** AI 应用（用途）= 主键，天然保证「一用途一端点」唯一约束。 */
    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 40)
    private AiModelPurpose purpose;

    @Column(name = "endpoint_id", nullable = false)
    private String endpointId;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
