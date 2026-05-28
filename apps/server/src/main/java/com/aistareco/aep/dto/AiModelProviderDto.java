package com.aistareco.aep.dto;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;

/**
 * AI provider 读 DTO。**永远不返回 apiKey 明文**，仅 apiKeyMasked。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiModelProviderDto(
        String id,
        String name,
        String providerType,
        String baseUrl,
        String apiKeyMasked,
        String apiVersion,
        String defaultModel,
        List<AiModelEntryDto> models,
        List<String> purposes,
        Integer priority,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    private static final ObjectMapper OM = new ObjectMapper();

    public static AiModelProviderDto from(AiModelProvider p) {
        // 解密 apiKey 后立即脱敏；密文不外泄
        String plaintext = null;
        try {
            plaintext = AepCryptoUtil.decrypt(p.getApiKeyEncrypted());
        } catch (Exception ignored) {}
        return new AiModelProviderDto(
                p.getId(),
                p.getName(),
                p.getProviderType() != null ? p.getProviderType().wire() : null,
                p.getBaseUrl(),
                plaintext != null ? AepCryptoUtil.mask(plaintext) : "***",
                p.getApiVersion(),
                p.getDefaultModel(),
                parseModels(p.getModelsJson()),
                p.getPurposes() != null ? p.getPurposes() : List.of(),
                p.getPriority(),
                p.isEnabled(),
                p.getCreatedAt(),
                p.getUpdatedAt()
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
