package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * 模板脚本（v0.5 新增）—— 视频生成的真正"剧本"。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts {@code TemplateScript}。
 *
 * 设计：
 *   - 一个 templateId 对多 version；同一 templateId 同时仅一条 PUBLISHED（service 层强约束）
 *   - 大对象（persona / scenes / visualStyle / variables / engineAdapters / durationVariants
 *       / postProcess / safety / referenceClip / experiment / metrics）全部走 JSON 列
 *   - kind 决定 referenceClipJson 是否必填；service 层校验
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "template_scripts",
    uniqueConstraints = @UniqueConstraint(columnNames = {"template_id", "version"})
)
public class TemplateScript {

    @Id
    private String id;

    @Column(name = "template_id", nullable = false)
    private String templateId;

    @Column(nullable = false)
    private Integer version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TemplateScriptStatus status;

    @Column(nullable = false)
    @Builder.Default
    private String language = "zh-CN";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TemplateScriptKind kind;

    /** Persona —— 角色画像 JSON。 */
    @Column(name = "persona_json", length = org.hibernate.Length.LONG32)
    private String personaJson;

    /** systemPrompt —— 顶层总体约束。 */
    @Column(name = "system_prompt", length = org.hibernate.Length.LONG32)
    private String systemPrompt;

    /** scenes[] JSON。 */
    @Column(name = "scenes_json", length = org.hibernate.Length.LONG32)
    private String scenesJson;

    /** visualStyle JSON。 */
    @Column(name = "visual_style_json", length = org.hibernate.Length.LONG32)
    private String visualStyleJson;

    /** negativePrompt 文本。 */
    @Column(name = "negative_prompt", length = org.hibernate.Length.LONG32)
    private String negativePrompt;

    /** variables[] JSON。 */
    @Column(name = "variables_json", length = org.hibernate.Length.LONG32)
    private String variablesJson;

    /** engineAdapters{} JSON。 */
    @Column(name = "engine_adapters_json", length = org.hibernate.Length.LONG32)
    private String engineAdaptersJson;

    /** durationVariants{} JSON。 */
    @Column(name = "duration_variants_json", length = org.hibernate.Length.LONG32)
    private String durationVariantsJson;

    /** postProcess JSON。 */
    @Column(name = "post_process_json", length = org.hibernate.Length.LONG32)
    private String postProcessJson;

    /** safety JSON。 */
    @Column(name = "safety_json", length = org.hibernate.Length.LONG32)
    private String safetyJson;

    /** referenceClip JSON（kind=VIDEO_REF 时必填）。 */
    @Column(name = "reference_clip_json", length = org.hibernate.Length.LONG32)
    private String referenceClipJson;

    /** experiment JSON（可选）。 */
    @Column(name = "experiment_json", length = org.hibernate.Length.LONG32)
    private String experimentJson;

    /** metrics JSON（系统回填）。 */
    @Column(name = "metrics_json", length = org.hibernate.Length.LONG32)
    private String metricsJson;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant publishedAt;
    private String publishedBy;
}
