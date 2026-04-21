package com.aistareco.aep.dto;

/**
 * 暴露给前端的 Forge AI Provider 状态。
 * 不返回任何敏感配置，仅用于决定页面是否可直接发起 live 锻造。
 */
public record ForgeProviderStatusDto(
        boolean configured,
        String provider,
        String message
) {}
