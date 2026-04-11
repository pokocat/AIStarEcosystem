package com.aistareco.dto;

/** Matches TypeScript TrackSummary. */
public record TrackSummaryDto(
        String id,
        String title,
        String style,
        int    durationSec,
        String durationLabel,
        String status,
        String date,
        long   plays
) {}
