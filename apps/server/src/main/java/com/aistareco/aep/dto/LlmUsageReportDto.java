package com.aistareco.aep.dto;

/** llm-gateway → server 的 usage 上报。 */
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
        long totalTokens
) {}
