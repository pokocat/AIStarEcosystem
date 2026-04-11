package com.aistareco.dto;

/** Matches TypeScript ChartEntry. */
public record ChartEntryDto(
        String id,
        String title,
        String artist,
        int    votes,
        String trend,
        String coverUrl
) {}
