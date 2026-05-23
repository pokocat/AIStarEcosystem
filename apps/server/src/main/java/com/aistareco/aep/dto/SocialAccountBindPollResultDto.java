package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

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
        SocialAccountDto account,
        Map<String, Object> interactionRequired,
        String errorCode,
        String message,
        String diagnosticId
) {
    public static SocialAccountBindPollResultDto pending() {
        return new SocialAccountBindPollResultDto("pending", null, null, null, null, null);
    }

    public static SocialAccountBindPollResultDto expired() {
        return new SocialAccountBindPollResultDto("expired", null, null, null, null, null);
    }

    public static SocialAccountBindPollResultDto success(SocialAccountDto account) {
        return new SocialAccountBindPollResultDto("success", account, null, null, null, null);
    }

    public static SocialAccountBindPollResultDto awaitingUser(Map<String, Object> interactionRequired) {
        return new SocialAccountBindPollResultDto("awaiting_user", null, interactionRequired, null, null, null);
    }

    public static SocialAccountBindPollResultDto failed(String errorCode, String message, String diagnosticId) {
        return new SocialAccountBindPollResultDto("failed", null, null, errorCode, message, diagnosticId);
    }
}
