package com.aistareco.aep.dto;

import com.aistareco.aep.model.PromptTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;

/**
 * Prompt 模板出 wire（admin GET / PUT 回包）。
 * params 解成结构化 {@link PromptParamsDto}，便于前端表单直接绑定。
 */
public record PromptTemplateDto(
        String id,
        String promptKey,
        String systemPrompt,
        String userTemplate,
        PromptParamsDto params,
        int version,
        boolean enabled,
        Instant updatedAt,
        String updatedBy
) {
    public static PromptTemplateDto from(PromptTemplate t, ObjectMapper om) {
        PromptParamsDto params = null;
        if (t.getParamsJson() != null && !t.getParamsJson().isBlank()) {
            try {
                params = om.readValue(t.getParamsJson(), PromptParamsDto.class);
            } catch (Exception ignored) {
                /* 损坏的 params JSON → null，由 PromptService 用默认值兜底 */
            }
        }
        return new PromptTemplateDto(
                t.getId(),
                t.getPromptKey(),
                t.getSystemPrompt(),
                t.getUserTemplate(),
                params,
                t.getVersion(),
                t.isEnabled(),
                t.getUpdatedAt(),
                t.getUpdatedBy()
        );
    }
}
