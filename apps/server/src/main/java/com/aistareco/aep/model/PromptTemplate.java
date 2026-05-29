package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Prompt 模板（素材运营文本三件 + 后续可扩展）。
 *
 * 决策（MATERIAL_OPS_AI_TEXT_PLAN §6）：system 与 user 模板都建表存，不放 .txt、
 * 不塞 PlatformConfig blob。运营可在后台改 prompt / 灰度 / 回滚，无需改代码或重启；
 * 代码只负责把业务参数填进 {{占位符}}。
 *
 * promptKey 与 AiModelPurpose 对齐：
 *   material.script_draft / material.selling_points / material.variable_extract
 *
 * 默认文案由 PromptTemplateSeeder 从 resources/prompts/material/*.md「缺行才插」灌库，
 * 不覆盖运营改过的行（按 promptKey 守门 + version 标记）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "prompt_template")
public class PromptTemplate {

    @Id
    private String id;

    /** 唯一键，对齐 AiModelPurpose（如 material.script_draft）。 */
    @Column(name = "prompt_key", nullable = false, unique = true, length = 64)
    private String promptKey;

    /** system 角色内容（空 → PromptService 取 resource 默认）。 */
    @Lob
    @Column(name = "system_prompt", columnDefinition = "LONGTEXT")
    private String systemPrompt;

    /** user 角色模板，含 {{placeholder}}（如 {{name}} / {{audience}} / {{banned_words}}）。 */
    @Lob
    @Column(name = "user_template", columnDefinition = "LONGTEXT")
    private String userTemplate;

    /** 调用参数 JSON：{ temperature, maxTokens, jsonMode }，注入 invokeChat。 */
    @Lob
    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson;

    /** 每次保存 +1；便于回滚 / 审计 / 判断运营是否改过（==1 表示仍是 seed 基线）。 */
    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    /** false → PromptService 跳过 DB，直接走 resource 默认。 */
    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;
}
