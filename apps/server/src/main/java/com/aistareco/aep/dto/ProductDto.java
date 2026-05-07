package com.aistareco.aep.dto;

import com.aistareco.aep.model.Product;

import java.time.LocalDate;
import java.util.List;

/**
 * Frontend mirror: apps/web/src/types/product.ts {@code Product}.
 * 字段名严格一致；前端 apiFetch 直接消费此 DTO 序列化结果。
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
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
