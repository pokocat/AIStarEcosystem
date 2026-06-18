package com.aistareco.aep.dto;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

/**
 * AI 模型接入端点读 DTO（v0.41；v0.81 移除外部 API Token）。
 * **永远不返回上游 apiKey 明文**（仅 upstreamApiKeyMasked）。
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
        String ownerUserId,
        String billingMode,
        long promptTokenPriceMicros,
        long completionTokenPriceMicros,
        long unitPriceMicros,
        long totalTokens,
        long totalBillableUnits,
        long totalBillableSeconds,
        long totalCalls,
        Instant lastUsedAt,
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
                e.getOwnerUserId(),
                e.getBillingMode() != null ? e.getBillingMode().name() : null,
                Math.max(0L, e.getPromptTokenPriceMicros()),
                Math.max(0L, e.getCompletionTokenPriceMicros()),
                Math.max(0L, e.getUnitPriceMicros()),
                e.getTotalTokens(),
                e.getTotalBillableUnits(),
                e.getTotalBillableSeconds(),
                e.getTotalCalls(),
                e.getLastUsedAt(),
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
