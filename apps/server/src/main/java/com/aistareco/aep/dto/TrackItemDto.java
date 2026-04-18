package com.aistareco.aep.dto;

public record TrackItemDto(
        String id,
        String title,
        String artist,
        String cover,
        String plays,
        String duration,
        boolean liked
) {}
