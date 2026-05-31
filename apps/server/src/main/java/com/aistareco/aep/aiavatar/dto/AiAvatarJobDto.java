package com.aistareco.aep.aiavatar.dto;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarJob;
import com.aistareco.aep.aiavatar.model.AiAvatarJobStatus;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 前端镜像：packages/types/src/ai-avatar.ts {@code AiAvatarJob}（异步任务中心）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAvatarJobDto(
        String id,
        String ownerUserId,
        String avatarId,
        String versionId,
        AiAvatarCapability capability,
        String capabilityLabel,
        AiAvatarJobStatus status,
        int progress,
        AiAvatarProviderMode providerMode,
        String engine,
        String title,
        JsonNode input,
        JsonNode result,
        String errorMessage,
        int attempts,
        int maxAttempts,
        long creditsHeld,
        String batchId,
        String createdAt,
        String startedAt,
        String completedAt
) {
    public static AiAvatarJobDto from(AiAvatarJob j, ObjectMapper mapper) {
        return new AiAvatarJobDto(
                j.getId(),
                j.getOwnerUserId(),
                j.getAvatarId(),
                j.getVersionId(),
                j.getCapability(),
                j.getCapability() == null ? null : j.getCapability().label(),
                j.getStatus(),
                j.getProgress(),
                j.getProviderMode(),
                j.getEngine(),
                j.getTitle(),
                AiAvatarJson.parseOrNull(j.getInputJson(), mapper),
                AiAvatarJson.parseOrNull(j.getResultJson(), mapper),
                j.getErrorMessage(),
                j.getAttempts(),
                j.getMaxAttempts(),
                j.getCreditsHeld(),
                j.getBatchId(),
                AiAvatarJson.fmt(j.getCreatedAt()),
                AiAvatarJson.fmt(j.getStartedAt()),
                AiAvatarJson.fmt(j.getCompletedAt())
        );
    }
}
