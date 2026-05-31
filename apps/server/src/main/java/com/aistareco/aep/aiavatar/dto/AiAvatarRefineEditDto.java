package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarRefineEdit;
import com.aistareco.aep.aiavatar.model.AiAvatarRefineKind;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarRefineEdit}（精调操作记录）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarRefineEditDto(
        String id,
        String avatarId,
        String versionId,
        AiAvatarRefineKind kind,
        String kindLabel,
        JsonNode params,
        String beforeAssetId,
        String afterAssetId,
        String jobId,
        String note,
        String createdAt
) {
    public static AiAvatarRefineEditDto from(AiAvatarRefineEdit e, ObjectMapper mapper) {
        return new AiAvatarRefineEditDto(
                e.getId(),
                e.getAvatarId(),
                e.getVersionId(),
                e.getKind(),
                e.getKind() == null ? null : e.getKind().label(),
                AiAvatarJson.parseOrNull(e.getParamsJson(), mapper),
                e.getBeforeAssetId(),
                e.getAfterAssetId(),
                e.getJobId(),
                e.getNote(),
                AiAvatarJson.fmt(e.getCreatedAt())
        );
    }
}
