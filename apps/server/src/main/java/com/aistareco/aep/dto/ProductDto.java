package com.aistareco.aep.dto;

import com.aistareco.aep.model.Product;

import java.time.LocalDate;
import java.util.List;

/**
 * Frontend mirror: packages/types/src/product.ts {@code Product}.
 * 字段名严格一致；前端 apiFetch 直接消费此 DTO 序列化结果。
 *
 * v0.26+: 加 priceCents / commissionRate（可空整数）。
 */
public record ProductDto(
        String id,
        String name,
        String category,
        String link,
        List<String> images,
        String sellingPoints,
        int usageCount,
        String source,
        Integer priceCents,
        Integer commissionRate,
        LocalDate createdAt,
        LocalDate updatedAt
) {
    public static ProductDto from(Product p) {
        return new ProductDto(
                p.getId(),
                p.getName(),
                p.getCategory(),
                p.getLink(),
                p.getImages() != null ? p.getImages() : List.of(),
                p.getSellingPoints() == null ? "" : p.getSellingPoints(),
                p.getUsageCount(),
                p.getSource(),
                p.getPriceCents(),
                p.getCommissionRate(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
