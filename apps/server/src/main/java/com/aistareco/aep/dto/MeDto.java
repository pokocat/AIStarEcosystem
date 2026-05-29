package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.service.PlatformSupport;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * Wire shape for GET /api/me — the logged-in user plus their owning Studio (if any).
 * The frontend treats this as "the agency entity the user is logged in as".
 * Fields 1-to-1 mirror AepUserDto; {@link #studio} is null for accounts without a Studio.
 */
public record MeDto(
        String id,
        String username,
        String email,
        String phone,
        String displayName,
        String avatarUrl,
        String walletAddress,
        String bio,
        String kind,
        String status,
        /** v0.31+: 内嵌运营角色（"operator" / "super_admin" / null）。详见 AepUser.operatorRole。 */
        String operatorRole,
        /** v0.43+: 可访问的子产品平台（["music","drama","celebrity"] 子集）。空配置回落为全集。 */
        List<String> platforms,
        boolean emailVerified,
        boolean phoneVerified,
        String langPreference,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt,
        StudioDto studio
) {
    public static MeDto from(AepUser u, Studio studio) {
        return new MeDto(
                u.getId(), u.getUsername(), u.getEmail(), u.getPhone(),
                u.getDisplayName(), u.getAvatarUrl(), u.getWalletAddress(),
                u.getBio(),
                lower(u.getKind()), lower(u.getStatus()),
                lower(u.getOperatorRole()),
                PlatformSupport.effective(u.getPlatforms()),
                u.isEmailVerified(), u.isPhoneVerified(), u.getLangPreference(),
                u.getCreatedAt(), u.getUpdatedAt(), u.getLastLoginAt(),
                studio == null ? null : StudioDto.from(studio)
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
