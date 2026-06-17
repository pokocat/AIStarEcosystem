package com.aistareco.aep.dto;

/** server 内嵌 OpenAI-compatible API 的 usage 记录入参。 */
public record LlmUsageReportDto(
        String keyId,
        String requestId,
        String upstreamId,
        Long latencyMs,
        String model,
        String purpose,
        String userId,
        String tenantId,
        String appCode,
        Boolean success,
        String errorCode,
        String errorMessage,
        long promptTokens,
        long completionTokens,
        long totalTokens,
        String requestBodyJson,
        String responseBodyJson,
        String replayOfRecordId
) {}
