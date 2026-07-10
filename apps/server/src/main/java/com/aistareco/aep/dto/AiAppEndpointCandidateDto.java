package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * AI 应用候选端点读 DTO（D-11，admin「候选端点 + 能力」块）。
 * {@code isDefault} = 该端点是否为该用途的默认端点（AiAppBinding.endpointId）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiAppEndpointCandidateDto(
        String purpose,
        String purposeLabel,
        String endpointId,
        String endpointName,
        Boolean endpointEnabled,
        boolean isDefault,
        int sortOrder,
        boolean enabled,
        EndpointCapabilityDto capability,
        Long creditCostOverride,
        Instant updatedAt
) {}
