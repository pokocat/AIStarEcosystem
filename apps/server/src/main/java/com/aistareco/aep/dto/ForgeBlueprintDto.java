package com.aistareco.aep.dto;

import com.aistareco.aep.model.ForgeBlueprint;

import java.time.Instant;
import java.util.Map;

public record ForgeBlueprintDto(
        String id,
        String artistId,
        String resultId,
        Map<String, Object> snapshot,
        Instant createdAt
) {
    public static ForgeBlueprintDto from(ForgeBlueprint b) {
        return new ForgeBlueprintDto(
                b.getId(), b.getArtistId(), b.getResultId(),
                b.getSnapshotJson(), b.getCreatedAt()
        );
    }
}
