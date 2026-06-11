package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarBrandAuthRequest;
import com.aistareco.aep.model.StarSampleStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/** 品牌授权申请 DTO（= TS StarBrandAuthRequest）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarBrandAuthRequestDto(
        String id,
        String brandName,
        List<String> authTypes,
        String purpose,
        int durationMonths,
        long amountCents,
        List<String> platforms,
        StarBrandAuthRequest.Status status,
        StarSampleStatus platformSample,
        StarSampleStatus celebSample,
        String submittedAt,
        String platformNote
) {
    public static StarBrandAuthRequestDto from(StarBrandAuthRequest b) {
        return new StarBrandAuthRequestDto(
                b.getId(),
                b.getBrandName(),
                b.getAuthTypes() != null ? b.getAuthTypes() : List.of(),
                b.getPurpose(),
                b.getDurationMonths(),
                b.getAmountCents(),
                b.getPlatforms() != null ? b.getPlatforms() : List.of(),
                b.getStatus(),
                b.getPlatformSample(),
                b.getCelebSample(),
                b.getSubmittedAt() != null ? b.getSubmittedAt().toString() : null,
                b.getPlatformNote()
        );
    }
}
