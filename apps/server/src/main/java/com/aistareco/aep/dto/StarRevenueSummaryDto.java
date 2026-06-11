package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarRevenueMonth;

import java.util.List;

/** 收益分成汇总 DTO（= TS StarRevenueSummary / StarRevenueMonth）。 */
public record StarRevenueSummaryDto(
        long totalGmvCents,
        long monthGmvCents,
        long pendingAmountCents,
        long paidAmountCents,
        List<StarRevenueMonthDto> months
) {
    public record StarRevenueMonthDto(
            String id,
            String month,
            long gmvCents,
            int sharePercent,
            long amountCents,
            String status
    ) {
        public static StarRevenueMonthDto from(StarRevenueMonth m) {
            return new StarRevenueMonthDto(
                    m.getId(),
                    m.getMonth(),
                    m.getGmvCents(),
                    m.getSharePercent(),
                    m.getAmountCents(),
                    m.getStatus().wire()
            );
        }
    }
}
