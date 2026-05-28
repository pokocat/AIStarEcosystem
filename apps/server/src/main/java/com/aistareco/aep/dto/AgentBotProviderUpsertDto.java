package com.aistareco.aep.dto;

/**
 * Agent bot 写请求。token 走明文（service 端加密落库）；PUT 时 token 缺省表示不修改。
 */
public record AgentBotProviderUpsertDto(
        String id,
        String name,
        String platform,
        String sceneKey,
        String apiBase,
        String token,
        String botId,
        String userIdPrefix,
        Integer readTimeoutMs,
        String description,
        Boolean enabled
) {}
