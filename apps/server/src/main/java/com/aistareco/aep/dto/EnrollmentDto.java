package com.aistareco.aep.dto;

import java.time.Instant;

/**
 * 子产品「开通」记录（统一账号中心 P2，docs/unified-identity-plan.md §2.1 / §12）。
 * 字段名与 packages/types/src/account.ts 的 {@code Enrollment} 1:1。
 *
 * @param product     子产品 key：music / drama / celebrity / aiavatar / star
 * @param status      pending | active | suspended | revoked（wire 全小写）
 * @param source      开通来源：license | trial | admin | grant_all（dev）| legacy（由旧 platforms CSV 回填）
 * @param activatedAt 开通时间，pending 为 null
 * @param validUntil  有效期，null = 长期
 */
public record EnrollmentDto(
        String product,
        String status,
        String source,
        Instant activatedAt,
        Instant validUntil
) {}
