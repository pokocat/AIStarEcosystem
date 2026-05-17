package com.aistareco.aep.dto;

import java.util.List;

/**
 * apps/server → apps/llm-gateway 推送的 upstream 配置。
 *
 * 注意：apiKey 字段是**解密后明文**——只允许通过内部接口（X-Internal-Secret 校验）返回。
 * 千万不要复用到管理后台 DTO。
 */
public record InternalUpstreamDto(
        String id,
        String providerType,
        String baseUrl,
        String apiKey,
        String defaultModel,
        List<String> modelPrefixes,
        Integer priority,
        boolean enabled
) {}
