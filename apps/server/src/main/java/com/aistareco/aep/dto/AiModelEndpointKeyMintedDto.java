package com.aistareco.aep.dto;

/**
 * 铸造网关 Key 的响应（v0.41）。{@code plaintext} **仅此一次**返回，DB 只存 bcrypt 哈希。
 * 运营拿到后必须立刻复制保存。
 */
public record AiModelEndpointKeyMintedDto(
        AiModelEndpointDto endpoint,
        String plaintext
) {}
