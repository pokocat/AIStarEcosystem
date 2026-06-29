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
        Boolean active,
        /** v2 §6 适用子应用：all=通用 / music|drama|celebrity|aiavatar|star。 */
        String appScope,
        /** v0.92 存储套餐：购买授予的存储扩容（MB），>0 即为「存储套餐」。 */
        Long grantStorageMb
) {}
