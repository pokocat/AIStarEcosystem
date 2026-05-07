package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

/**
 * CelebrityTemplate — 模板生成模式下可选的预制模板（v2.7）。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code CelebrityTemplate}。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "celebrity_templates")
public class CelebrityTemplate {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    /** TemplateStyle：种草安利 / 硬核测评 / 轻松开箱 / 直播切片 / 剧情植入。 */
    @Column(nullable = false)
    private String style;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** CelebrityEngine：KeLing / HiGen / MiniMax。 */
    @Column(nullable = false)
    private String recommendedEngine;

    /** EnginePriceLevel：经济 / 标准 / 高级。 */
    @Column(nullable = false)
    private String recommendedPrice;

    private boolean isHot;

    private String plays;
    private String conversionRate;

    @Column(columnDefinition = "TEXT")
    private String fitHint;

    /** previews 数组（{thumb, videoUrl}[]） JSON。 */
    @Column(name = "previews_json", columnDefinition = "TEXT")
    private String previewsJson;
}
