package com.aistareco.aep.dto;

import com.aistareco.aep.model.RechargePackage;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Frontend mirror: apps/web/src/types/wallet.ts {@code RechargePackage}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RechargePackageDto(
        String id,
        long credits,
        long priceCents,
        String tag,
        boolean recommended,
        Long bonusCredits,
        Integer sortOrder,
        /** v2 §6 适用子应用：all=通用 / music|drama|celebrity|aiavatar|star。 */
        String appScope
) {
    public static RechargePackageDto from(RechargePackage p) {
        return new RechargePackageDto(
                p.getId(),
                p.getCredits(),
                p.getPriceCents(),
                p.getTag(),
                p.isRecommended(),
                p.getBonusCredits() > 0 ? p.getBonusCredits() : null,
                p.getSortOrder(),
                p.getAppScope() == null || p.getAppScope().isBlank() ? "all" : p.getAppScope()
        );
    }
}
