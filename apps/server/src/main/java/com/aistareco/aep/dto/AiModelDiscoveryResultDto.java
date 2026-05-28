package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 模型发现结果。ok=true 时 models 为解析后的可用模型；失败时带 statusCode / error。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiModelDiscoveryResultDto(
        boolean ok,
        Integer statusCode,
        List<AiModelEntryDto> models,
        String error
) {
    public static AiModelDiscoveryResultDto ok(Integer statusCode, List<AiModelEntryDto> models) {
        return new AiModelDiscoveryResultDto(true, statusCode, models, null);
    }

    public static AiModelDiscoveryResultDto fail(Integer statusCode, String error) {
        return new AiModelDiscoveryResultDto(false, statusCode, List.of(), error);
    }
}
