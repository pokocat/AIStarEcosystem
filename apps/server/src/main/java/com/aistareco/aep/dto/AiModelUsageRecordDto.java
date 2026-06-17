package com.aistareco.aep.dto;

import java.time.Instant;

/** 单次 LLM 调用用量明细，供 admin 审计台下钻。 */
public record AiModelUsageRecordDto(
        String id,
        Instant createdAt,
        String providerId,
        String providerName,
        String model,
        String purpose,
        String purposeLabel,
        String userId,
        String userLabel,
        String tenantId,
        String tenantLabel,
        String appCode,
        String appLabel,
        long promptTokens,
        long completionTokens,
        long totalTokens,
        boolean success,
        long estimatedCostMicros,
        String requestId,
        String upstreamId,
        Long latencyMs,
        String errorCode,
        String errorMessage,
        String requestBodyJson,
        String responseBodyJson,
        String replayOfRecordId,
        Integer qualityScore,
        String qualityLabel,
        String qualityNote
) {}
