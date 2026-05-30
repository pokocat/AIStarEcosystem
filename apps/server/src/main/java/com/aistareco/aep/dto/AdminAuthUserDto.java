package com.aistareco.aep.dto;

import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AepUser;

import java.time.Instant;
import java.util.Locale;

/**
 * Unified identity shape for admin console authentication.
 *
 * <p>accountSource tells the admin frontend whether the JWT belongs to the
 * admin_users table or an AepUser with operatorRole.
 */
public record AdminAuthUserDto(
        String id,
        String username,
        String email,
        String displayName,
        String role,
        String status,
        String accountSource,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt
) {
    public static AdminAuthUserDto fromAdmin(AdminUser admin) {
        return new AdminAuthUserDto(
                admin.getId(),
                admin.getUsername(),
                admin.getEmail(),
                admin.getDisplayName(),
                lower(admin.getRole()),
                lower(admin.getStatus()),
                "admin",
                admin.getCreatedAt(),
                admin.getUpdatedAt(),
                admin.getLastLoginAt()
        );
    }

    public static AdminAuthUserDto fromOperator(AepUser user) {
        return new AdminAuthUserDto(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getDisplayName(),
                lower(user.getOperatorRole()),
                lower(user.getStatus()),
                "operator",
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getLastLoginAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
