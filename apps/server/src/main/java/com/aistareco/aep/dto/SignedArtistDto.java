package com.aistareco.aep.dto;

import com.aistareco.aep.model.SignedArtist;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.Locale;

public record SignedArtistDto(
        String id,
        String name,
        String type,
        String typeIcon,
        String avatar,
        String mcn,
        LocalDate contractEnd,
        String monthlyRevenue,
        String totalRevenue,
        String fans,
        String status,
        int royaltyRate,
        int contentCount
) {
    public static SignedArtistDto from(SignedArtist a) {
        return new SignedArtistDto(
                a.getId(),
                a.getName(),
                a.getArtistType(),
                a.getTypeIcon(),
                a.getAvatar(),
                a.getMcn(),
                a.getContractEnd(),
                formatCredits(a.getMonthlyRevenueCredits()),
                formatCredits(a.getTotalRevenueCredits()),
                formatFans(a.getFansCount()),
                lower(a.getStatus()),
                a.getRoyaltyRate(),
                a.getContentCount()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }

    private static String formatCredits(long credits) {
        return "¥" + NumberFormat.getIntegerInstance(Locale.US).format(credits);
    }

    private static String formatFans(long count) {
        if (count >= 1_000_000) {
            return String.format("%.1fM", count / 1_000_000.0);
        } else if (count >= 1_000) {
            return String.format("%dK", count / 1_000);
        }
        return String.valueOf(count);
    }
}
