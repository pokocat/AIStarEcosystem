package com.aistareco.aep.dto;

import com.aistareco.aep.model.Studio;

import java.time.Instant;
import java.util.Locale;

/**
 * Extended Studio DTO for admin endpoints.
 * Includes read-only aggregated metrics computed by the backend.
 */
public record AdminStudioDto(
        String id,
        String ownerUserId,
        String ownerUsername,
        String name,
        String kind,
        String status,
        String bio,
        String logoUrl,
        String contactEmail,
        String contactPhone,
        Instant createdAt,
        Instant updatedAt,
        // ── admin-side aggregated metrics (read-only) ──
        int artistCount,
        int songCount,
        long totalRevenueCredits,
        long monthlyRevenueCredits
) {
    public static AdminStudioDto from(Studio s,
                                      String ownerUsername,
                                      int artistCount,
                                      int songCount,
                                      long totalRevenueCredits,
                                      long monthlyRevenueCredits) {
        return new AdminStudioDto(
                s.getId(), s.getOwnerUserId(), ownerUsername, s.getName(),
                lower(s.getKind()), lower(s.getStatus()),
                s.getBio(), s.getLogoUrl(),
                s.getContactEmail(), s.getContactPhone(),
                s.getCreatedAt(), s.getUpdatedAt(),
                artistCount, songCount, totalRevenueCredits, monthlyRevenueCredits
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
