package com.aistareco.aep.dto;

import com.aistareco.aep.model.LlmApiKey;

import java.time.Instant;

/** Admin / business 列表用，**永远不返回明文 key**。 */
public record LlmApiKeyDto(
        String id,
        String keyPrefix,
        String keyMasked,
        String userId,
        String name,
        boolean enabled,
        long totalTokens,
        long totalCalls,
        Instant lastUsedAt,
        Instant revokedAt,
        Instant createdAt,
        Instant updatedAt
) {
    public static LlmApiKeyDto from(LlmApiKey k) {
        return new LlmApiKeyDto(
                k.getId(),
                k.getKeyPrefix(),
                k.getKeyPrefix() + "…",
                k.getUserId(),
                k.getName(),
                k.isEnabled(),
                k.getTotalTokens(),
                k.getTotalCalls(),
                k.getLastUsedAt(),
                k.getRevokedAt(),
                k.getCreatedAt(),
                k.getUpdatedAt()
        );
    }
}
