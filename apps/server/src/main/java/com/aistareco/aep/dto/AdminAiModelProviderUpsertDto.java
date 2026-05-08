package com.aistareco.aep.dto;

import java.util.List;

/**
 * admin POST/PUT 请求体。apiKey 走明文（service 层加密落库）。
 */
public record AdminAiModelProviderUpsertDto(
        String id,
        String name,
        String providerType,
        String baseUrl,
        String apiKey,                 // 明文；可能在 PUT 时省略表示"不修改 apiKey"
        String apiVersion,
        String defaultModel,
        List<String> purposes,
        Integer priority,
        Boolean enabled
) {}
