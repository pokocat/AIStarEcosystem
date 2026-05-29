package com.aistareco.aep.dto;

/**
 * Prompt 调用参数。null 字段由 PromptService 用默认值兜底。
 */
public record PromptParamsDto(
        Double temperature,
        Integer maxTokens,
        Boolean jsonMode
) {
    public static final double DEFAULT_TEMPERATURE = 0.7;
    public static final int DEFAULT_MAX_TOKENS = 2048;
    public static final boolean DEFAULT_JSON_MODE = true;

    public double temperatureOrDefault() {
        return temperature != null ? temperature : DEFAULT_TEMPERATURE;
    }

    public int maxTokensOrDefault() {
        return maxTokens != null && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
    }

    public boolean jsonModeOrDefault() {
        return jsonMode != null ? jsonMode : DEFAULT_JSON_MODE;
    }
}
