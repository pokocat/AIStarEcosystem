package com.aistareco.aep.dto;

public record AiModelQualityUpdateDto(
        Integer score,
        String label,
        String note
) {}
