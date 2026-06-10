package com.aistareco.aep.dto;

import java.time.Instant;

public record TransactionDto(
        String id,
        String source,
        long amount,
        String date,
        /** v0.58：精确到秒的创建时间（date 仅到天，保留兼容老消费方）。 */
        Instant createdAt,
        String status,
        String type,
        String userId,
        /** v0.58：账号登录名 / 昵称（结算中心业务交易视图溯源用）。 */
        String username,
        String displayName
) {}
