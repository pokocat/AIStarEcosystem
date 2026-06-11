package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarProductOnboard;
import com.aistareco.aep.model.StarSampleStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 商品入库单 DTO（= TS StarProductOnboard）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarProductOnboardDto(
        String id,
        String productId,
        String productName,
        String brand,
        String category,
        int priceCents,
        StarProductOnboard.Source source,
        String submittedBy,
        String mcnName,
        int step,
        StarSampleStatus platformSample,
        StarSampleStatus celebSample,
        String submittedAt,
        String trackingPlatform,
        String trackingCeleb,
        String platformNote
) {
    public static StarProductOnboardDto from(StarProductOnboard p) {
        return new StarProductOnboardDto(
                p.getId(),
                p.getProductId(),
                p.getProductName(),
                p.getBrand(),
                p.getCategory(),
                p.getPriceCents(),
                p.getSource(),
                p.getSubmittedBy(),
                p.getMcnName(),
                p.getStep(),
                p.getPlatformSample(),
                p.getCelebSample(),
                p.getSubmittedAt() != null ? p.getSubmittedAt().toString() : null,
                p.getTrackingPlatform(),
                p.getTrackingCeleb(),
                p.getPlatformNote()
        );
    }
}
