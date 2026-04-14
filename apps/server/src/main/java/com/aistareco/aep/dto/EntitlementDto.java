package com.aistareco.aep.dto;

import com.aistareco.aep.model.Entitlement;

import java.time.Instant;

public record EntitlementDto(
        String id,
        String tenantId,
        String productId,
        String planId,
        Entitlement.EntitlementType entitlementType,
        String featureCode,
        String value,
        Instant validFrom,
        Instant validTo,
        Entitlement.EntitlementStatus status,
        Instant createdAt
) {
    public static EntitlementDto from(Entitlement e) {
        return new EntitlementDto(
                e.getId(), e.getTenantId(), e.getProductId(), e.getPlanId(),
                e.getEntitlementType(), e.getFeatureCode(), e.getValue(),
                e.getValidFrom(), e.getValidTo(), e.getStatus(), e.getCreatedAt()
        );
    }
}
