package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarAiLikenessRequest;
import com.aistareco.aep.model.StarReviewStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** AI 形象授权申请 DTO（= TS StarAiLikenessRequest）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarAiLikenessRequestDto(
        String id,
        String mcnName,
        StarAiLikenessRequest.ModelType modelType,
        StarAiLikenessRequest.RiskLevel riskLevel,
        List<String> platforms,
        String purpose,
        String requestedAt,
        StarReviewStatus status,
        String aiVendor
) {
    public static StarAiLikenessRequestDto from(StarAiLikenessRequest r) {
        return new StarAiLikenessRequestDto(
                r.getId(),
                r.getMcnName(),
                r.getModelType(),
                r.getRiskLevel(),
                r.getPlatforms() != null ? r.getPlatforms() : List.of(),
                r.getPurpose(),
                r.getRequestedAt() != null ? r.getRequestedAt().toString() : null,
                r.getStatus(),
                r.getAiVendor()
        );
    }
}
