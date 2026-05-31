package com.aistareco.aep.dto;

import com.aistareco.aep.model.DramaPublishJob;

/**
 * 镜像 packages/types/src/publish-job.ts 的 PublishJob 消费子集（drama 分发用）。
 * 时间字段为 ISO 字符串。
 */
public record DramaPublishJobDto(
        String id,
        String userId,
        String projectId,
        String platformId,
        String platformName,
        String status,
        int progress,
        String videoUrl,
        String externalUrl,
        String errorCode,
        String errorMessage,
        String scheduledAt,
        String createdAt,
        String updatedAt
) {
    public static DramaPublishJobDto from(DramaPublishJob j) {
        return new DramaPublishJobDto(
                j.getId(),
                j.getOwnerUserId(),
                j.getProjectId(),
                j.getPlatformId(),
                j.getPlatformName(),
                j.getStatus(),
                j.getProgress(),
                j.getVideoUrl(),
                j.getExternalUrl(),
                j.getErrorCode(),
                j.getErrorMessage(),
                j.getScheduledAt() == null ? null : j.getScheduledAt().toString(),
                j.getCreatedAt() == null ? null : j.getCreatedAt().toString(),
                j.getUpdatedAt() == null ? null : j.getUpdatedAt().toString()
        );
    }
}
