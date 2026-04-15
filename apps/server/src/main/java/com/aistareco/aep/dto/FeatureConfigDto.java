package com.aistareco.aep.dto;

import com.aistareco.aep.model.FeatureConfig;

import java.time.Instant;

public record FeatureConfigDto(
        String id,
        String configKey,
        String configGroup,
        FeatureConfig.ValueType valueType,
        String value,
        String defaultValue,
        FeatureConfig.Scope scope,
        String productId,
        String planId,
        String tenantId,
        boolean isActive,
        boolean isEditableByOperator,
        String description,
        String minValue,
        String maxValue,
        String updatedBy,
        Instant updatedAt,
        Instant createdAt
) {
    public static FeatureConfigDto from(FeatureConfig config) {
        return new FeatureConfigDto(
                config.getId(),
                config.getConfigKey(),
                config.getConfigGroup(),
                config.getValueType(),
                config.getValue(),
                config.getDefaultValue(),
                config.getScope(),
                config.getProductId(),
                config.getPlanId(),
                config.getTenantId(),
                config.isActive(),
                config.isEditableByOperator(),
                config.getDescription(),
                config.getMinValue(),
                config.getMaxValue(),
                config.getUpdatedBy(),
                config.getUpdatedAt(),
                config.getCreatedAt()
        );
    }
}
