package com.aistareco.aep.dto;

import com.aistareco.aep.model.PromptTemplateVersion;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;

public record PromptTemplateVersionDto(
        String id,
        String promptKey,
        int version,
        String systemPrompt,
        String userTemplate,
        PromptParamsDto params,
        boolean enabled,
        Instant createdAt,
        String createdBy,
        String changeNote
) {
    public static PromptTemplateVersionDto from(PromptTemplateVersion v, ObjectMapper om) {
        PromptParamsDto params = null;
        if (v.getParamsJson() != null && !v.getParamsJson().isBlank()) {
            try {
                params = om.readValue(v.getParamsJson(), PromptParamsDto.class);
            } catch (Exception ignored) {}
        }
        return new PromptTemplateVersionDto(
                v.getId(), v.getPromptKey(), v.getVersion(),
                v.getSystemPrompt(), v.getUserTemplate(), params,
                v.isEnabled(), v.getCreatedAt(), v.getCreatedBy(), v.getChangeNote());
    }
}
