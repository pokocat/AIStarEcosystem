package com.aistareco.aep.dto;

import java.util.List;

/**
 * admin POST/PUT 端点请求体（v0.41）。上游 apiKey 走明文（service 层加密落库）。
 * 网关 Key 不在此处设置 —— 走单独的 mint-key / revoke-key 端点。
 */
public record AdminAiModelEndpointUpsertDto(
        String id,
        String name,
        String providerType,
        String baseUrl,
        String apiKey,                 // 上游明文密钥；PUT 时省略表示「不修改」
        String apiVersion,
        String model,                  // 固定单模型
        List<AiModelEntryDto> models,  // 可用模型列表（discover-models 拉取后写入）
        String ownerUserId,            // 计费归属用户；空 = 平台级不计费
        Boolean enabled
) {}
