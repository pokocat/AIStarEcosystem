package com.aistareco.aep.dto;

/** LLM 失败原因聚合行。 */
public record AiModelFailureStatDto(
        String category,
        String label,
        long calls
) {}
