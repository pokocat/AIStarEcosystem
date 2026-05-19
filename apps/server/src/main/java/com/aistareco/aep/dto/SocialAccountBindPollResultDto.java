package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 响应 DTO：GET /api/me/social-accounts/bind-poll
 *
 * status:
 *   - pending  : 扫码中，前端继续轮询
 *   - success  : 已绑定，account 字段含清洁版 SocialAccount
 *   - expired  : 超时 (sau-service in-memory ticket TTL 5 min)
 *
 * Mirror packages/types/src/social-account.ts SocialAccountBindPollResult。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialAccountBindPollResultDto(
        String status,
        SocialAccountDto account
) {
    public static SocialAccountBindPollResultDto pending() {
        return new SocialAccountBindPollResultDto("pending", null);
    }

    public static SocialAccountBindPollResultDto expired() {
        return new SocialAccountBindPollResultDto("expired", null);
    }

    public static SocialAccountBindPollResultDto success(SocialAccountDto account) {
        return new SocialAccountBindPollResultDto("success", account);
    }
}
