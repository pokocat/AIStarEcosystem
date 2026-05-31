package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarAsset;
import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.model.AiAvatarStandardShot;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarAsset}。camelCase 对齐。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarAssetDto(
        String id,
        String avatarId,
        String versionId,
        AiAvatarAssetKind kind,
        AiAvatarStandardShot standardShot,
        String fileUrl,
        String thumbnailUrl,
        String mimeType,
        int width,
        int height,
        long fileSize,
        double durationSec,
        String format3d,
        String engine,
        AiAvatarProviderMode providerMode,
        String watermarkToken,
        boolean encrypted,
        JsonNode meta,
        String createdAt
) {
    public static AiAvatarAssetDto from(AiAvatarAsset a, ObjectMapper mapper) {
        return new AiAvatarAssetDto(
                a.getId(),
                a.getAvatarId(),
                a.getVersionId(),
                a.getKind(),
                a.getStandardShot(),
                a.getFileUrl(),
                a.getThumbnailUrl(),
                a.getMimeType(),
                a.getWidth(),
                a.getHeight(),
                a.getFileSize(),
                a.getDurationSec(),
                a.getFormat3d(),
                a.getEngine(),
                a.getProviderMode(),
                a.getWatermarkToken(),
                a.isEncrypted(),
                AiAvatarJson.parseOrNull(a.getMetaJson(), mapper),
                AiAvatarJson.fmt(a.getCreatedAt())
        );
    }
}
