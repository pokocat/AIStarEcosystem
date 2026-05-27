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

    @Column(columnDefinition = "LONGTEXT")
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

    @Column(columnDefinition = "LONGTEXT")
    private String fitHint;

    /** previews 数组（{thumb, videoUrl}[]） JSON。 */
    @Column(name = "previews_json", columnDefinition = "LONGTEXT")
    private String previewsJson;

    // ── v0.4 字段：模板效果预览（admin 上传整段预览视频） ─────────────────────

    /** 缩略图 URL。 */
    @Column(length = 512)
    private String previewCover;

    /** 整段效果预览视频 URL。 */
    @Column(length = 512)
    private String previewVideoUrl;

    /** 推荐时长（15 / 30 / 60 秒）。 */
    private Integer durationSec;

    // ── v0.34 字段：工厂 / 用户模板归属（镜像 MixcutTemplate pattern）──────────

    /**
     * 是否工厂模板（运营初始化、所有用户可见）。
     * 老数据默认 true —— v0.34 之前所有模板都由 admin/seeder 上传，全部视为 factory。
     *
     * 注意：@Builder.Default 必加 —— Lombok 的 @Builder 不读取 Java 字段初始值，
     * builder field 默认是 boolean 的 false（≠ Java 字段写的 true）。加 @Builder.Default
     * 让 builder 也用 = true 作为默认。漏加会导致 builder().build() 实例的 isFactory
     * 始终是 false，与 Java 字段声明的语义不一致。
     */
    @Builder.Default
    @Column(name = "is_factory", nullable = false)
    @org.hibernate.annotations.ColumnDefault("true")
    private boolean isFactory = true;

    /**
     * "factory" 或 ownerUserId。listTemplates 用此过滤可见性。
     * @Builder.Default 必加（同 isFactory 原因）—— 漏加会让 builder().build() 的
     * ownerScope 是 null，撞 NOT NULL 约束。
     */
    @Builder.Default
    @Column(name = "owner_scope", length = 64, nullable = false)
    @org.hibernate.annotations.ColumnDefault("'factory'")
    private String ownerScope = "factory";

    /** 用户自建模板的 owner（isFactory=true 时为 null）。 */
    @Column(name = "owner_user_id", length = 64)
    private String ownerUserId;
}
