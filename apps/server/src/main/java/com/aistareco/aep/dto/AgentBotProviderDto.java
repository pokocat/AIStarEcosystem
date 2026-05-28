package com.aistareco.aep.dto;

import com.aistareco.aep.model.AgentBotProvider;
import com.aistareco.common.AepCryptoUtil;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * Agent bot 读 DTO。**永远不返回 token 明文**，仅 tokenMasked。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AgentBotProviderDto(
        String id,
        String name,
        String platform,
        String sceneKey,
        String apiBase,
        String tokenMasked,
        String botId,
        String userIdPrefix,
        Integer readTimeoutMs,
        String description,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    public static AgentBotProviderDto from(AgentBotProvider p) {
        String plaintext = null;
        try {
            plaintext = AepCryptoUtil.decrypt(p.getTokenEncrypted());
        } catch (Exception ignored) {}
        return new AgentBotProviderDto(
                p.getId(),
                p.getName(),
                p.getPlatform() != null ? p.getPlatform().wire() : null,
                p.getSceneKey(),
                p.getApiBase(),
                plaintext != null ? AepCryptoUtil.mask(plaintext) : "***",
                p.getBotId(),
                p.getUserIdPrefix(),
                p.getReadTimeoutMs(),
                p.getDescription(),
                p.isEnabled(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
