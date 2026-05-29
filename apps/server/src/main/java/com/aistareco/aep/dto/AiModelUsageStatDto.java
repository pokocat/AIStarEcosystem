package com.aistareco.aep.dto;

/**
 * 大模型用量聚合行（v0.41）。按服务商或模型分组的统计单元。
 *
 * @param key   分组键（providerId 或 model id）
 * @param label 展示名（providerName 或 model id）
 */
public record AiModelUsageStatDto(
        String key,
        String label,
        long calls,
        long totalTokens,
        long promptTokens,
        long completionTokens
) {}
