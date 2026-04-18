package com.aistareco.aep.dto;

import com.aistareco.aep.model.ForgeResult;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

public record ForgeResultDto(
        String id,
        String image,
        String prompt,
        String mode,
        Instant createdAt,
        List<String> locked
) {
    public static ForgeResultDto from(ForgeResult r) {
        return new ForgeResultDto(
                r.getId(),
                r.getImage(),
                r.getPrompt(),
                lower(r.getMode()),
                r.getCreatedAt(),
                r.getLocked()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
