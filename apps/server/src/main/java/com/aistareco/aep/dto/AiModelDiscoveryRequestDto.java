package com.aistareco.aep.dto;

/**
 * 模型发现请求：用给定 baseUrl + apiKey 调服务商 GET /models 拉取可用模型列表。
 * 用于「新建 provider 时，填好 AK 先拉一遍模型再保存」。
 * providerType 可空（默认按 OPENAI_COMPATIBLE 处理）。
 */
public record AiModelDiscoveryRequestDto(
        String providerType,
        String baseUrl,
        String apiKey
) {}
