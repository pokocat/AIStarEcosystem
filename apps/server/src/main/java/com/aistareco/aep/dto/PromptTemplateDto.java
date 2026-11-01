package com.aistareco.aep.dto;

import com.aistareco.aep.model.PromptTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

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
        List<String> variables,
        int version,
        boolean enabled,
        Instant updatedAt,
        String updatedBy,
        /** 已经搬进 Studio「提示词与技能」的键：库里对应的环节（Studio 不再读这里，后台改了不生效）；没搬为 null。 */
        String movedTo,
        /** 已经没有调用点的键（行还在，改了不生效）。 */
        boolean retired
) {
    public PromptTemplateDto(String id, String promptKey, String systemPrompt, String userTemplate, PromptParamsDto params, List<String> variables,
                             int version, boolean enabled, Instant updatedAt, String updatedBy) {
        this(id, promptKey, systemPrompt, userTemplate, params, variables, version, enabled, updatedAt, updatedBy, null, false);
    }

    public PromptTemplateDto withStudioNotes(String movedTo, boolean retired) {
        return new PromptTemplateDto(id, promptKey, systemPrompt, userTemplate, params, variables, version, enabled, updatedAt, updatedBy, movedTo, retired);
    }

    public static PromptTemplateDto from(PromptTemplate t, ObjectMapper om) {
        return from(t, om, List.of());
    }

    public static PromptTemplateDto from(PromptTemplate t, ObjectMapper om, List<String> variables) {
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
                variables == null ? List.of() : variables,
                t.getVersion(),
                t.isEnabled(),
                t.getUpdatedAt(),
                t.getUpdatedBy()
        );
    }
}
