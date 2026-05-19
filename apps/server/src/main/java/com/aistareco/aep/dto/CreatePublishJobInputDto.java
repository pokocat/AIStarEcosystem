package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

/**
 * 请求 DTO：POST /api/me/publish-jobs
 *
 * 一次提交 N 个 targets[]，按数组长度产生 N 条 PublishJob (每条都从 queued 起步，不扣费)。
 *
 * Mirror packages/types/src/publish-job.ts CreatePublishJobInput。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CreatePublishJobInputDto(
        String projectId,
        String videoUrl,
        String title,
        String description,
        List<String> tags,
        String coverUrl,
        List<Target> targets
) {
    public record Target(
            String platform,
            String socialAccountId,
            Instant scheduledAt
    ) {}
}
