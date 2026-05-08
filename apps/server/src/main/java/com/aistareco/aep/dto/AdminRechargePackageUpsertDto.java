package com.aistareco.aep.dto;

/**
 * admin POST/PUT /api/admin/finance/recharge-packages[/{id}] 请求体。
 * 字段集对齐 apps/web/src/types/wallet.ts RechargePackage（+ active 软删字段）。
 */
public record AdminRechargePackageUpsertDto(
        String id,
        Long credits,
        Long priceCents,
        String tag,
        Boolean recommended,
        Long bonusCredits,
        Integer sortOrder,
        Boolean active
) {}
