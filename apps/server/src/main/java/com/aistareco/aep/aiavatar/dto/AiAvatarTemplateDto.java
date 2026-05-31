package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplate;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplateCategory;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarTemplate}（AI 模板中心）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarTemplateDto(
        String id,
        String name,
        AiAvatarTemplateCategory category,
        String categoryLabel,
        String description,
        String thumbnailUrl,
        JsonNode params,
        AiAvatarCapability capability,
        boolean official,
        String ownerUserId,
        boolean enabled,
        int usageCount,
        String createdAt,
        String updatedAt
) {
    public static AiAvatarTemplateDto from(AiAvatarTemplate t, ObjectMapper mapper) {
        return new AiAvatarTemplateDto(
                t.getId(),
                t.getName(),
                t.getCategory(),
                t.getCategory() == null ? null : t.getCategory().label(),
                t.getDescription(),
                t.getThumbnailUrl(),
                AiAvatarJson.parseOrNull(t.getParamsJson(), mapper),
                t.getCapability(),
                t.isOfficial(),
                t.getOwnerUserId(),
                t.isEnabled(),
                t.getUsageCount(),
                AiAvatarJson.fmt(t.getCreatedAt()),
                AiAvatarJson.fmt(t.getUpdatedAt())
        );
    }
}
