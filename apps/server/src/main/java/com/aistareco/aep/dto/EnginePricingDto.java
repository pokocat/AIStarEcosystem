package com.aistareco.aep.dto;

/**
 * Frontend mirror: apps/web/src/api/celebrity-zone.ts {@code EnginePricing}.
 * GET /celebrity/engine-pricing 返回 Map&lt;CelebrityEngine, EnginePricing&gt;。
 */
public record EnginePricingDto(int creditPrice, int quotaCost) {
}
