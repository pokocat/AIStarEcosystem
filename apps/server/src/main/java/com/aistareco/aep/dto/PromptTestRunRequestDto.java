package com.aistareco.aep.dto;

import java.util.Map;

public record PromptTestRunRequestDto(
        Map<String, String> vars,
        String endpointId
) {}
