package com.aistareco.aep.dto;

import com.aistareco.aep.model.Product;

import java.time.Instant;

public record ProductDto(
        String id,
        String code,
        String name,
        String description,
        boolean enabled,
        Instant createdAt
) {
    public static ProductDto from(Product p) {
        return new ProductDto(
                p.getId(), p.getCode(), p.getName(), p.getDescription(),
                p.isEnabled(), p.getCreatedAt()
        );
    }
}
