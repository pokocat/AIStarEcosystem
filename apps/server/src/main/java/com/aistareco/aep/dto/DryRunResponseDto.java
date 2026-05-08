package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * 试跑响应：装配后的引擎请求 + 警告信息。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DryRunResponseDto(
        String scriptId,
        Integer scriptVersion,
        EngineRequestBodyDto request,
        List<String> warnings
) {}
