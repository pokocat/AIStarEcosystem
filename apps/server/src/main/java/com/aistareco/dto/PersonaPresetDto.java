package com.aistareco.dto;

/** Matches TypeScript PersonaPreset. */
public record PersonaPresetDto(
        String id,
        String name,
        String icon,
        PersonaParamsDto values
) {}
