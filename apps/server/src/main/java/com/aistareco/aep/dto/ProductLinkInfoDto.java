package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * 前端镜像：packages/types/src/product-link.ts ProductLinkInfo。
 * server 端 ProductLinkHandler 策略链统一返回此形态。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductLinkInfoDto(
        @JsonProperty("title") String title,
        @JsonProperty("image_urls") List<String> imageUrls,
        @JsonProperty("min_price_cents") Integer minPriceCents,
        @JsonProperty("max_price_cents") Integer maxPriceCents,
        @JsonProperty("sales") Integer sales,
        @JsonProperty("inferred_selling_points") String inferredSellingPoints,
        @JsonProperty("source") String source
) {
}
