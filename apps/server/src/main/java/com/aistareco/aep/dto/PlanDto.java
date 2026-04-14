package com.aistareco.aep.dto;

import com.aistareco.aep.model.Plan;

import java.time.Instant;

public record PlanDto(
        String id,
        String productId,
        String code,
        String name,
        long monthlyPriceCents,
        long annualPriceCents,
        boolean enabled,
        Instant createdAt
) {
    public static PlanDto from(Plan p) {
        return new PlanDto(
                p.getId(), p.getProductId(), p.getCode(), p.getName(),
                p.getMonthlyPriceCents(), p.getAnnualPriceCents(),
                p.isEnabled(), p.getCreatedAt()
        );
    }
}
