package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;

import java.time.Instant;
import java.util.Locale;

public record AepUserDto(
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
        boolean emailVerified,
        boolean phoneVerified,
        String langPreference,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AepUserDto from(AepUser u) {
        return new AepUserDto(
                u.getId(), u.getUsername(), u.getEmail(), u.getPhone(),
                u.getDisplayName(), u.getAvatarUrl(), u.getWalletAddress(),
                u.getBio(),
                lower(u.getKind()), lower(u.getStatus()),
                u.isEmailVerified(), u.isPhoneVerified(), u.getLangPreference(),
                u.getCreatedAt(), u.getUpdatedAt(), u.getLastLoginAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
