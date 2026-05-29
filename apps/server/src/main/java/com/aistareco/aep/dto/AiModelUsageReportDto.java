package com.aistareco.aep.dto;

import java.time.Instant;
import java.util.List;

/**
 * 大模型用量报表（v0.41）。
 *
 * 时间窗 = 最近 windowDays 天（since 起）。byProvider / byModel 为该窗内的分组聚合。
 * 单服务商查询时 byProvider 退化为单行（仅该服务商）。
 */
public record AiModelUsageReportDto(
        int windowDays,
        Instant since,
        long totalCalls,
        long totalTokens,
        long promptTokens,
        long completionTokens,
        List<AiModelUsageStatDto> byProvider,
        List<AiModelUsageStatDto> byModel
) {}
