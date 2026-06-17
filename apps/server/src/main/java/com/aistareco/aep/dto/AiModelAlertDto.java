package com.aistareco.aep.dto;

import java.time.Instant;

/** LLM 管理端告警快照。 */
public record AiModelAlertDto(
        String id,
        String severity,
        String type,
        String providerId,
        String providerName,
        String title,
        String message,
        long metricValue,
        long threshold,
        Instant createdAt
) {}
