package com.aistareco.aep.aiavatar.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;

/**
 * AI 模板（任务书 §7 AI 模板中心 / 模板美化&标准出图）。
 *
 * 美颜 / 风格 / 质感 / 标准构图模板；可叠加（GFPGAN + 调色 + 妆容迁移）。
 * 工厂模板（isOfficial=true，所有用户可见）+ 用户私有模板（ownerUserId 非空）。
 */
@Entity
@Table(name = "aiavatar_template", indexes = {
        @Index(name = "idx_aiavatar_template_category", columnList = "category"),
        @Index(name = "idx_aiavatar_template_owner", columnList = "ownerUserId")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAvatarTemplate {

    @Id
    @Column(length = 64)
    private String id;

    @Column(length = 128, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private AiAvatarTemplateCategory category;

    @Column(length = 512)
    private String description;

    @Column(length = 1024)
    private String thumbnailUrl;

    /** 模板参数 JSON（{beautyStrength, colorGrade, makeupRef, smoothing, composition…}）。 */
    @Lob
    @Column(name = "params_json", columnDefinition = "LONGTEXT")
    private String paramsJson;

    /** 该模板驱动的能力（restore / makeup / txt2img …）。 */
    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private AiAvatarCapability capability;

    @Column(nullable = false)
    @ColumnDefault("true")
    @Builder.Default
    private boolean official = true;

    /** 用户私有模板归属（official=false 时非空）。 */
    @Column(length = 64)
    private String ownerUserId;

    @Column(nullable = false)
    @ColumnDefault("true")
    @Builder.Default
    private boolean enabled = true;

    @Column(nullable = false)
    @ColumnDefault("0")
    @Builder.Default
    private int usageCount = 0;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;
}
