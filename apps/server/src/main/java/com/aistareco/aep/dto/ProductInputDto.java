package com.aistareco.aep.dto;

import java.util.List;

/**
 * Frontend mirror: packages/types/src/product.ts {@code ProductInput}。
 * 用于 POST /products 与 PATCH /products/{id} 的请求体反序列化。
 * Java record 在 Spring 通过 Jackson 自动绑定。
 *
 * v0.26+: 加 priceCents / commissionRate（可空整数）。
 */
public record ProductInputDto(
        String name,
        String category,
        String link,
        List<String> images,
        String sellingPoints,
        String source,
        Integer priceCents,
        Integer commissionRate
) {
}
