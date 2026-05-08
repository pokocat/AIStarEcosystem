package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * PromptAssemblyService 的输出。前端真值源 EngineRequestBody（celebrity-zone.ts）。
 *
 * v0.5：本期不真调引擎，仅返回装配后的请求体供 admin 试跑预览 / 生成器响应附带 digest。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EngineRequestBodyDto(
        String engine,
        String positive,
        String negative,
        Map<String, Object> params,
        Map<String, Object> videoReference,
        String fallbackEngine
) {}
