package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarDigitalHumanRequest;
import com.aistareco.aep.model.StarReviewStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** 数字人授权申请 DTO（= TS StarDigitalHumanRequest）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarDigitalHumanRequestDto(
        String id,
        String mcnName,
        StarDigitalHumanRequest.UsageType usageType,
        List<String> platforms,
        String purpose,
        int durationMonths,
        String requestedAt,
        StarReviewStatus status,
        String riskNote
) {
    public static StarDigitalHumanRequestDto from(StarDigitalHumanRequest r) {
        return new StarDigitalHumanRequestDto(
                r.getId(),
                r.getMcnName(),
                r.getUsageType(),
                r.getPlatforms() != null ? r.getPlatforms() : List.of(),
                r.getPurpose(),
                r.getDurationMonths(),
                r.getRequestedAt() != null ? r.getRequestedAt().toString() : null,
                r.getStatus(),
                r.getRiskNote()
        );
    }
}
