package com.aistareco.aep.dto;

import com.aistareco.aep.model.AdminUser;

import java.time.Instant;
import java.util.Locale;

public record AdminUserDto(
        String id,
        String username,
        String email,
        String displayName,
        String role,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AdminUserDto from(AdminUser u) {
        return new AdminUserDto(
                u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(),
                lower(u.getRole()), lower(u.getStatus()),
                u.getCreatedAt(), u.getUpdatedAt(), u.getLastLoginAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
