package com.aistareco.aep.dto;

import com.aistareco.aep.model.ForgeResult;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

public record ForgeResultDto(
        String id,
        String artistId,
        String image,
        String videoUrl,
        String prompt,
        String mode,
        Instant createdAt,
        List<String> locked
) {
    public static ForgeResultDto from(ForgeResult r) {
        return new ForgeResultDto(
                r.getId(),
                r.getArtistId(),
                r.getImage(),
                r.getVideoUrl(),
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
