package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.JsonNode;

/** Preserve reported usage for image as well as chat responses; missing usage stays unknown. */
public record AiModelTokenUsage(Long input, Long output, Long total) {
    public static AiModelTokenUsage from(JsonNode response) {
        JsonNode usage = response == null ? null : response.path("usage");
        Long input = number(usage, "prompt_tokens", "input_tokens");
        Long output = number(usage, "completion_tokens", "output_tokens");
        Long total = number(usage, "total_tokens", "total_tokens");
        if (total == null && input != null && output != null) total = input + output;
        return new AiModelTokenUsage(input, output, total);
    }

    private static Long number(JsonNode node, String primary, String alternate) {
        if (node == null) return null;
        JsonNode value = node.path(primary);
        if (!value.isIntegralNumber()) value = node.path(alternate);
        return value.isIntegralNumber() && value.canConvertToLong() && value.longValue() >= 0 ? value.longValue() : null;
    }
}
