package com.aistareco.aep.dto;

/**
 * AI 应用候选端点写请求（D-11）。POST（新增）时 endpointId 必填；PUT（改能力）走 path 上的 endpointId，
 * body 只带 capability + override + enabled + sortOrder（null 字段表示不修改）。
 */
public record AiAppEndpointCandidateUpsert(
        String endpointId,
        Integer sortOrder,
        Boolean enabled,
        Integer maxRefImages,
        Boolean supportsFirstLastFrame,
        Boolean supportsSubjectReference,
        Integer maxDurationSec,
        Long creditCostOverride
) {}
