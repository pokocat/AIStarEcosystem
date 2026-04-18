package com.aistareco.aep.dto;

import com.aistareco.aep.model.CreditPack;

import java.util.List;
import java.util.Locale;

public record CreditPackDto(
        String id,
        String code,
        String name,
        long credits,
        long priceCents,
        List<String> highlights,
        Boolean recommended,
        String status
) {
    public static CreditPackDto from(CreditPack p) {
        return new CreditPackDto(
                p.getId(),
                lower(p.getCode()),
                p.getName(),
                p.getCredits(),
                p.getPriceCents(),
                p.getHighlights(),
                p.getRecommended(),
                lower(p.getStatus())
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
