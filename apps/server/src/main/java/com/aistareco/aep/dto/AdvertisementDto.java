package com.aistareco.aep.dto;

import com.aistareco.aep.model.Advertisement;

import java.util.Locale;

public record AdvertisementDto(
        String id,
        String brand,
        String product,
        String type,
        int duration,
        String status,
        long payment,
        long views
) {
    public static AdvertisementDto from(Advertisement a) {
        return new AdvertisementDto(
                a.getId(),
                a.getBrand(),
                a.getProduct(),
                upperType(a.getType()),
                a.getDuration(),
                lower(a.getStatus()),
                a.getPayment(),
                a.getViews()
        );
    }

    /** Ad type keeps original casing: TVC, digital, print, social. */
    private static String upperType(Advertisement.AdType t) {
        if (t == null) return null;
        return switch (t) {
            case TVC -> "TVC";
            case DIGITAL -> "digital";
            case PRINT -> "print";
            case SOCIAL -> "social";
        };
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
