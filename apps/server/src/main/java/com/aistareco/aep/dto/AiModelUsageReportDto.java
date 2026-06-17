package com.aistareco.aep.dto;

import java.time.Instant;
import java.util.List;

/**
 * 大模型用量报表（v0.41；用量统计补全：用途 / 按天 / 失败维度）。
 *
 * 时间窗 = 最近 windowDays 天（since 起）。byProvider / byModel / byPurpose 为该窗内的分组聚合，
 * 仅统计成功调用；byDay 为按自然日的时间序列。failedCalls 为该窗内失败调用数（单独计数）。
 * 单服务商查询时 byProvider 退化为单行（仅该服务商）。
 */
public record AiModelUsageReportDto(
        int windowDays,
        Instant since,
        long totalCalls,
        long totalTokens,
        long promptTokens,
        long completionTokens,
        long failedCalls,
        List<AiModelUsageStatDto> byProvider,
        List<AiModelUsageStatDto> byModel,
        List<AiModelUsageStatDto> byPurpose,
        List<AiModelUsageDailyDto> byDay
) {}
