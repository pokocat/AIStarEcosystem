package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * 响应 DTO：POST /api/me/social-accounts/bind-init
 *
 * sau-service 启动 Playwright 后返回的 QR code。
 *
 * Mirror packages/types/src/social-account.ts SocialAccountBindInit。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialAccountBindInitDto(
        String sessionTicket,
        String qrImageDataUrl,
        String qrUrl,
        Instant expiresAt
) {}
