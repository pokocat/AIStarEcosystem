package com.aistareco.aep.dto;

/**
 * 请求 DTO：POST /api/me/social-accounts/bind-init
 *
 * Mirror packages/types/src/social-account.ts SocialAccountBindInput。
 */
public record SocialAccountBindInputDto(
        String platform,
        String accountName
) {}
