package com.aistareco.aep.dto;

/**
 * 铸造外部 API Token 的响应。{@code plaintext} **仅此一次**返回，DB 只存 bcrypt 哈希。
 * 运营拿到后必须立刻复制保存。
 */
public record AiModelEndpointKeyMintedDto(
        AiModelEndpointDto endpoint,
        String plaintext
) {}
