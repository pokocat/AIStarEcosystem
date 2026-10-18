package com.aistareco.aep.dto;

import java.util.List;

/**
 * admin POST/PUT 端点请求体（v0.41）。上游 apiKey 走明文（service 层加密落库）。
 * 外部 API Token 不在此处设置，走单独的 mint-key / revoke-key 端点。
 */
public record AdminAiModelEndpointUpsertDto(
        String id,
        String name,
        String providerType,
        String baseUrl,
        String apiKey,                 // 上游明文密钥；PUT 时省略表示「不修改」
        String apiVersion,
        String model,                  // 固定单模型
        String modelAlias,             // 业务别名；空字符串可清空
        Double defaultTemperature,
        Integer defaultMaxTokens,
        Double defaultTopP,
        Boolean chatSupportsTemperature,
        Boolean chatSupportsTopP,
        Boolean chatSupportsResponseFormat,
        Integer chatMaxOutputTokens,
        Boolean chatSupportsTools,      // null = 不改；true/false 显式声明（未声明的端点按不支持处理）
        Boolean chatSupportsStreaming,  // 同上：只有显式 true 才走供应商真流式
        com.aistareco.aep.model.AiImageRequestSpec imageRequestSpec,
        Boolean clearImageRequestSpec,
        com.aistareco.aep.model.AiVideoRequestSpec videoRequestSpec,
        Boolean clearVideoRequestSpec,
        Integer rpmLimit,
        Integer concurrencyLimit,
        Integer tpmLimit,
        Long dailyTokenQuota,
        Long dailyCostQuotaMicros,
        Integer alertFailureRatePct,
        List<AiModelEntryDto> models,  // 可用模型列表（discover-models 拉取后写入）
        String ownerUserId,            // 计费归属用户；空 = 平台级不计费
        String billingMode,            // null/"AUTO" = 自动；TOKENS / PER_CALL / PER_SECOND
        Long promptTokenPriceMicros,   // 输入 token 单价，人民币微元 / 1K Token
        Long completionTokenPriceMicros, // 输出 token 单价，人民币微元 / 1K Token
        Long unitPriceMicros,          // 按次/按秒单价，人民币微元 / 次 或 / 秒
        Boolean enabled
) {}
