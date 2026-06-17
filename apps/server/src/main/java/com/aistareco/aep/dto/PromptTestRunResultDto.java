package com.aistareco.aep.dto;

import java.util.List;
import java.util.Map;

public record PromptTestRunResultDto(
        String promptKey,
        String system,
        String user,
        PromptParamsDto params,
        List<String> variables,
        List<String> missingVariables,
        Map<String, String> sampleVars,
        String output,
        String finishReason,
        Long tokensUsed,
        String endpointUsed,
        String modelUsed
) {}
