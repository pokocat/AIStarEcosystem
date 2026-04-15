package com.aistareco.aep.dto;

import com.aistareco.aep.model.Entitlement;

import java.time.Instant;

public record EntitlementDto(
        String id,
        String tenantId,
        String productId,
        String planId,
        String entitlementType,
        String featureCode,
        String value,
        Instant validFrom,
        Instant validTo,
        String status,
        Instant createdAt
) {
    public static EntitlementDto from(Entitlement e) {
        return new EntitlementDto(
                e.getId(), e.getTenantId(), e.getProductId(), e.getPlanId(),
                e.getEntitlementType().name().toLowerCase(), e.getFeatureCode(), e.getValue(),
                e.getValidFrom(), e.getValidTo(), e.getStatus().name().toLowerCase(), e.getCreatedAt()
        );
    }
}
