package com.aistareco.aep.dto;

/** 创建后唯一返回明文的响应。运营必须立即复制保存。 */
public record LlmApiKeyCreatedDto(
        LlmApiKeyDto key,
        String plaintext
) {}
