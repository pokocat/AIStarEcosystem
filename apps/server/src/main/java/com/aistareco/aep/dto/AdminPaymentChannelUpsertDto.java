package com.aistareco.aep.dto;

import java.util.Map;

/**
 * 支付渠道配置更新入参（admin，v0.94）。
 *
 * <p>{@code creds}：渠道机密明文 map（key=字段名）。<b>空串 / 缺省 = 保留原值</b>（前端不回显明文，
 * 留空即不改该字段）；要清空某字段须显式传特殊标记 {@code "__CLEAR__"}。后端整块加密落库。
 */
public record AdminPaymentChannelUpsertDto(
        Boolean enabled,
        Boolean sandbox,
        String label,
        Integer sortOrder,
        String defaultWayCode,
        Map<String, String> creds
) {}
