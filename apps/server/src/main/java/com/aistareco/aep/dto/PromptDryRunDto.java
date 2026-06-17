package com.aistareco.aep.dto;

import java.util.List;
import java.util.Map;

public record PromptDryRunDto(
        String promptKey,
        String system,
        String user,
        PromptParamsDto params,
        List<String> variables,
        List<String> missingVariables,
        Map<String, String> sampleVars
) {}
