package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarProductOnboard;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 商品库条目 DTO（= TS StarProductLibItem）。由 step=5 的入库单派生。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarProductLibItemDto(
        String id,
        String productId,
        String productName,
        String brand,
        String category,
        String approvedAt,
        int priceCents,
        String mcnName,
        int salesCount
) {
    public static StarProductLibItemDto from(StarProductOnboard p) {
        return new StarProductLibItemDto(
                "pl-" + p.getId(),
                p.getProductId(),
                p.getProductName(),
                p.getBrand(),
                p.getCategory(),
                p.getLibraryAt() != null ? p.getLibraryAt().toString() : (p.getSubmittedAt() != null ? p.getSubmittedAt().toLocalDate().toString() : null),
                p.getPriceCents(),
                p.getMcnName() != null && !p.getMcnName().isBlank() ? p.getMcnName() : p.getSubmittedBy(),
                p.getSalesCount()
        );
    }
}
