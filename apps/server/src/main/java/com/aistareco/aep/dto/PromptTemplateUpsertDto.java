package com.aistareco.aep.dto;

/**
 * Prompt 模板入 wire（admin PUT）。promptKey 走路径变量，不在 body。
 * 任一字段为 null 表示不改（保留原值）；enabled 为 null 视为 true。
 */
public record PromptTemplateUpsertDto(
        String systemPrompt,
        String userTemplate,
        PromptParamsDto params,
        Boolean enabled
) {}
