package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * sau-service → server 的进度推送 payload。
 * POST /api/internal/sau/job-callback (受 X-Internal-Secret 保护)。
 *
 * 以 externalTaskId 做幂等 key；状态只允许单调推进（AWAITING_USER 是例外，
 * 见 PublishJobStatus.canTransitionTo），重复或反向回调忽略。
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
        String errorMessage,
        /**
         * 进入 awaiting_user 时由 sau-service 推；离开 awaiting_user 时显式置 null。
         * 其它 status 必须留空。结构 mirror InteractionRequired in packages/types。
         */
        Map<String, Object> interactionRequired
) {}
