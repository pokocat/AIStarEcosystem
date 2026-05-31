package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatar;
import com.aistareco.aep.aiavatar.model.AiAvatarStatus;
import com.aistareco.aep.aiavatar.model.AiAvatarCreationMode;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatar}（资产总库卡片）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarDto(
        String id,
        String ownerUserId,
        String studioId,
        String name,
        AiAvatarCreationMode mode,
        AiAvatarStatus status,
        String statusLabel,
        String persona,
        JsonNode personaStructured,
        String styleCategory,
        String coverAssetId,
        String coverUrl,
        String currentVersionId,
        String finalizedVersionId,
        boolean has3d,
        boolean hasVideo,
        List<String> tags,
        String forkedFromAvatarId,
        String createdAt,
        String updatedAt,
        String archivedAt
) {
    public static AiAvatarDto from(AiAvatar a, ObjectMapper mapper, String coverUrl) {
        return new AiAvatarDto(
                a.getId(),
                a.getOwnerUserId(),
                a.getStudioId(),
                a.getName(),
                a.getMode(),
                a.getStatus(),
                a.getStatus() == null ? null : a.getStatus().label(),
                a.getPersona(),
                AiAvatarJson.parseOrNull(a.getPersonaStructuredJson(), mapper),
                a.getStyleCategory(),
                a.getCoverAssetId(),
                coverUrl,
                a.getCurrentVersionId(),
                a.getFinalizedVersionId(),
                a.isHas3d(),
                a.isHasVideo(),
                a.getTags() == null ? List.of() : a.getTags(),
                a.getForkedFromAvatarId(),
                AiAvatarJson.fmt(a.getCreatedAt()),
                AiAvatarJson.fmt(a.getUpdatedAt()),
                AiAvatarJson.fmt(a.getArchivedAt())
        );
    }
}
