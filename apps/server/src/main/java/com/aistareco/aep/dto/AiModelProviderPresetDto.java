package com.aistareco.aep.dto;

/**
 * 内置大模型服务商预设（仅模板，不落库）。
 * admin 选中一个预设 → 自动填充 name / providerType / baseUrl / suggestedModel，
 * 运营再补 apiKey 即可创建一条真实 provider 配置。
 */
public record AiModelProviderPresetDto(
        String code,
        String name,
        String providerType,
        String baseUrl,
        String suggestedModel,
        String docsUrl,
        String apiKeyHint
) {}
