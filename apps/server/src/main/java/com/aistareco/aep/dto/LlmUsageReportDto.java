package com.aistareco.aep.dto;

/** llm-gateway → server 的 usage 上报。 */
public record LlmUsageReportDto(
        String keyId,
        String requestId,
        String upstreamId,
        String model,
        long promptTokens,
        long completionTokens,
        long totalTokens
) {}
