package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarStatus;
import com.aistareco.aep.aiavatar.model.AiAvatarVersion;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarVersion}（版本时间线）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarVersionDto(
        String id,
        String avatarId,
        int versionNo,
        String label,
        String note,
        String author,
        AiAvatarStatus sourceStatus,
        JsonNode params,
        String previewAssetId,
        String previewUrl,
        List<String> assetIds,
        String jobId,
        boolean preferred,
        boolean discarded,
        String createdAt
) {
    public static AiAvatarVersionDto from(AiAvatarVersion v, ObjectMapper mapper, String previewUrl) {
        return new AiAvatarVersionDto(
                v.getId(),
                v.getAvatarId(),
                v.getVersionNo(),
                v.getLabel(),
                v.getNote(),
                v.getAuthor(),
                v.getSourceStatus(),
                AiAvatarJson.parseOrNull(v.getParamsJson(), mapper),
                v.getPreviewAssetId(),
                previewUrl,
                v.getAssetIds() == null ? List.of() : v.getAssetIds(),
                v.getJobId(),
                v.isPreferred(),
                v.isDiscarded(),
                AiAvatarJson.fmt(v.getCreatedAt())
        );
    }
}
