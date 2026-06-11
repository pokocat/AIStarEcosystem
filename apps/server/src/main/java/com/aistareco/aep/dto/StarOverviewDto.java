package com.aistareco.aep.dto;

import java.util.List;

/** 工作台总览 DTO（= TS StarOverview）。 */
public record StarOverviewDto(
        int ipActiveCount,
        int ipTotalCount,
        int pendingTotal,
        int productLibraryCount,
        int activeBrandDeals,
        long monthGmvCents,
        int monthGmvDeltaPercent,
        long monthRevenueCents,
        List<StarPendingModuleDto> pendingByModule
) {
    /** = TS StarPendingModule。 */
    public record StarPendingModuleDto(String module, int count) {
    }
}
