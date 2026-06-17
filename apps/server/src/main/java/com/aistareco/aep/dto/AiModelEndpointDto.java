package com.aistareco.aep.dto;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

/**
 * AI 模型接入端点读 DTO（v0.41）。
 * **永远不返回上游 apiKey 明文**（仅 upstreamApiKeyMasked），也**永远不返回外部 API Token 明文**（仅 keyMasked）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiModelEndpointDto(
        String id,
        String name,
        String providerType,
        String baseUrl,
        String upstreamApiKeyMasked,
        String apiVersion,
        String model,
        String modelAlias,
        Double defaultTemperature,
        Integer defaultMaxTokens,
        Double defaultTopP,
        Integer rpmLimit,
        Integer tpmLimit,
        Long dailyTokenQuota,
        Long dailyCostQuotaMicros,
        Integer alertFailureRatePct,
        List<AiModelEntryDto> models,
        // 外部 API Token
        String keyPrefix,
        String keyMasked,
        boolean hasKey,
        String ownerUserId,
        long promptTokenPriceMicros,
        long completionTokenPriceMicros,
        long totalTokens,
        long totalCalls,
        Instant lastUsedAt,
        Instant keyRevokedAt,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    private static final ObjectMapper OM = new ObjectMapper();

    public static AiModelEndpointDto from(AiModelEndpoint e) {
        // 解密上游 apiKey 后立即脱敏；密文不外泄
        String plaintext = null;
        try {
            plaintext = AepCryptoUtil.decrypt(e.getUpstreamApiKeyEncrypted());
        } catch (Exception ignored) {}
        boolean hasKey = e.getKeyHash() != null && !e.getKeyHash().isBlank() && e.getKeyRevokedAt() == null;
        return new AiModelEndpointDto(
                e.getId(),
                e.getName(),
                e.getProviderType() != null ? e.getProviderType().wire() : null,
                e.getBaseUrl(),
                plaintext != null ? AepCryptoUtil.mask(plaintext) : "***",
                e.getApiVersion(),
                e.getModel(),
                e.getModelAlias(),
                e.getDefaultTemperature(),
                e.getDefaultMaxTokens(),
                e.getDefaultTopP(),
                e.getRpmLimit(),
                e.getTpmLimit(),
                e.getDailyTokenQuota(),
                e.getDailyCostQuotaMicros(),
                e.getAlertFailureRatePct(),
                parseModels(e.getModelsJson()),
                e.getKeyPrefix(),
                e.getKeyPrefix() != null ? e.getKeyPrefix() + "…" : null,
                hasKey,
                e.getOwnerUserId(),
                Math.max(0L, e.getPromptTokenPriceMicros()),
                Math.max(0L, e.getCompletionTokenPriceMicros()),
                e.getTotalTokens(),
                e.getTotalCalls(),
                e.getLastUsedAt(),
                e.getKeyRevokedAt(),
                e.isEnabled(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    private static List<AiModelEntryDto> parseModels(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OM.readValue(json, new TypeReference<List<AiModelEntryDto>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }
}
