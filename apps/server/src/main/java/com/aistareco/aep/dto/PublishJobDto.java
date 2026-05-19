package com.aistareco.aep.dto;

import com.aistareco.aep.model.PublishJob;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * 发布任务读 DTO。
 *
 * Mirror packages/types/src/publish-job.ts PublishJob 字段；
 * platformId / platformName 是冗余展示字段（与 Platform.id 对齐）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishJobDto(
        String id,
        String userId,
        String projectId,
        String socialAccountId,
        String platformId,
        String platformName,
        String status,
        int progress,
        String videoUrl,
        String title,
        String description,
        List<String> tags,
        String coverUrl,
        String externalTaskId,
        String externalUrl,
        String errorMessage,
        Long creditsSpent,
        Instant scheduledAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static PublishJobDto from(PublishJob j) {
        return new PublishJobDto(
                j.getId(),
                j.getUserId(),
                j.getProjectId(),
                j.getSocialAccountId(),
                j.getPlatformId() != null ? j.getPlatformId() : (j.getPlatform() != null ? j.getPlatform().wire() : null),
                j.getPlatformName(),
                j.getStatus() != null ? j.getStatus().wire() : null,
                j.getProgress(),
                j.getVideoUrl(),
                j.getTitle(),
                j.getDescription(),
                j.getTags() != null ? j.getTags() : List.of(),
                j.getCoverUrl(),
                j.getExternalTaskId(),
                j.getExternalUrl(),
                j.getErrorMessage(),
                j.getCreditsSpent(),
                j.getScheduledAt(),
                j.getCreatedAt(),
                j.getUpdatedAt()
        );
    }
}
