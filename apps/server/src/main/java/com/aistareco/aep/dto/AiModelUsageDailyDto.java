package com.aistareco.aep.dto;

/**
 * 大模型用量「按天」聚合行（v0.41 用量统计补全）。
 *
 * date 为 Asia/Shanghai 时区下的自然日（ISO yyyy-MM-dd）。仅统计成功调用。
 * 分桶在 service 侧用 ZoneId 完成，以避开 H2 / MySQL 日期函数方言差异。
 */
public record AiModelUsageDailyDto(
        String date,
        long calls,
        long totalTokens,
        long promptTokens,
        long completionTokens,
        long billableUnits,
        long billableSeconds,
        long estimatedCostMicros
) {}
