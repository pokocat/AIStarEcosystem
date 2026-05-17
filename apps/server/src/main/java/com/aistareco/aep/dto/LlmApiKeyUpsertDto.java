package com.aistareco.aep.dto;

public record LlmApiKeyUpsertDto(
        String userId,
        String name,
        Boolean enabled
) {}
