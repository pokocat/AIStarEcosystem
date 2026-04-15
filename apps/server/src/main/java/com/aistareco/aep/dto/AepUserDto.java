package com.aistareco.aep.dto;

import com.aistareco.aep.model.AepUser;

import java.time.Instant;

public record AepUserDto(
        String id,
        String username,
        String email,
        String phone,
        String displayName,
        String avatarUrl,
        String walletAddress,
        String role,
        String plan,
        long credits,
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
                u.getRole().name().toLowerCase(), u.getPlan().name().toLowerCase(), u.getCredits(), u.getStatus().name().toLowerCase(),
                u.isEmailVerified(), u.isPhoneVerified(), u.getLangPreference(),
                u.getCreatedAt(), u.getUpdatedAt(), u.getLastLoginAt()
        );
    }
}
