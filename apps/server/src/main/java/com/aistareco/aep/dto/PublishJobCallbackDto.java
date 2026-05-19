package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * sau-service → server 的进度推送 payload。
 * POST /api/internal/sau/job-callback (受 X-Internal-Secret 保护)。
 *
 * 以 externalTaskId 做幂等 key；状态只允许单调推进，重复或反向回调忽略。
 *
 * Mirror packages/types/src/publish-job.ts PublishJobCallback。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishJobCallbackDto(
        String externalTaskId,
        String status,
        Integer progress,
        String externalUrl,
        String errorCode,
        String errorMessage
) {}
