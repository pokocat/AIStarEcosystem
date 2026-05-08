package com.aistareco.aep.dto;

/**
 * 授权状态机推动请求体。
 *
 *   to     合法目标态（unauthorized / pending / authorized / expired）
 *   reason 操作原因（写入 AuditLog；运营必填，否则 service 抛 400）
 */
public record AdminCelebrityAuthorizationTransitionDto(
        String to,
        String reason
) {}
