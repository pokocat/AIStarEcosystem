package com.aistareco.dto;

/** Matches TypeScript ExpressionPreset. */
public record ExpressionPresetDto(
        String id,
        String name,
        String emoji,
        int intensity,
        String category
) {}
