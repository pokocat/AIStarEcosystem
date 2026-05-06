package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityProjectVideo;

import java.time.LocalDate;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityProjectVideo}.
 */
public record CelebrityProjectVideoDto(
        String id,
        String projectId,
        String projectName,
        String starId,
        String starName,
        String productName,
        String status,
        String plays,
        int durationSec,
        String engine,
        String thumb,
        String videoUrl,
        LocalDate createdAt
) {
    public static CelebrityProjectVideoDto from(CelebrityProjectVideo v) {
        return new CelebrityProjectVideoDto(
                v.getId(), v.getProjectId(), v.getProjectName(),
                v.getStarId(), v.getStarName(), v.getProductName(),
                v.getStatus(), v.getPlays(), v.getDurationSec(),
                v.getEngine(), v.getThumb(), v.getVideoUrl(),
                v.getCreatedAt()
        );
    }
}
