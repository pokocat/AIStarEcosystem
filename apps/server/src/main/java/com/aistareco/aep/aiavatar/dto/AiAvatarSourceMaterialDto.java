package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarSourceMaterial;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarSourceMaterial}。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarSourceMaterialDto(
        String id,
        String avatarId,
        String kind,
        String assetId,
        String assetUrl,
        String text,
        JsonNode faceCheck,
        Boolean faceCheckPassed,
        String createdAt
) {
    public static AiAvatarSourceMaterialDto from(AiAvatarSourceMaterial m, ObjectMapper mapper, String assetUrl) {
        return new AiAvatarSourceMaterialDto(
                m.getId(),
                m.getAvatarId(),
                m.getKind(),
                m.getAssetId(),
                assetUrl,
                m.getText(),
                AiAvatarJson.parseOrNull(m.getFaceCheckJson(), mapper),
                m.getFaceCheckPassed(),
                AiAvatarJson.fmt(m.getCreatedAt())
        );
    }
}
