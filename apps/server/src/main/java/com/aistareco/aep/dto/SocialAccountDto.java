package com.aistareco.aep.dto;

import com.aistareco.aep.model.SocialAccount;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * 用户绑定的社交账号读 DTO。
 *
 * **不暴露 storageStateEncrypted 字段**；cookie 仅在 server DB 加密存储，
 * 前端无论 USE_MOCK 还是真实流都拿不到 storage_state。
 *
 * 字段名必须 mirror packages/types/src/social-account.ts SocialAccount。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SocialAccountDto(
        String id,
        String userId,
        String platform,
        String accountName,
        String status,
        String displayName,
        String avatarUrl,
        Instant boundAt,
        Instant lastVerifiedAt
) {
    public static SocialAccountDto from(SocialAccount a) {
        return new SocialAccountDto(
                a.getId(),
                a.getUserId(),
                a.getPlatform() != null ? a.getPlatform().wire() : null,
                a.getAccountName(),
                a.getStatus() != null ? a.getStatus().wire() : null,
                a.getDisplayName(),
                a.getAvatarUrl(),
                a.getBoundAt(),
                a.getLastVerifiedAt()
        );
    }
}
