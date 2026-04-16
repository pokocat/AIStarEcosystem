package com.aistareco.aep.dto;

import com.aistareco.aep.model.Entitlement;

import java.time.Instant;
import java.util.Locale;

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
                lower(e.getEntitlementType()), e.getFeatureCode(), e.getValue(),
                e.getValidFrom(), e.getValidTo(), lower(e.getStatus()), e.getCreatedAt()
        );
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}
