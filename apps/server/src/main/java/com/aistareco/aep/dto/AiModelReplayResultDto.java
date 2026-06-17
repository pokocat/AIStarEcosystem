package com.aistareco.aep.dto;

public record AiModelReplayResultDto(
        String sourceRecordId,
        String output,
        String finishReason,
        Long tokensUsed,
        String endpointUsed,
        String modelUsed
) {}
