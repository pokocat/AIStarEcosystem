package com.aistareco.aep.dto;

/**
 * Aggregation-only DTO — no backing entity.
 */
public record PlatformViewPointDto(
        String name,
        long views
) {}
