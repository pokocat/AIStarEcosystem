package com.aistareco.aep.dto;

/**
 * 明星档案编辑请求体（= TS StarProfileUpdateInput，v0.62）。
 * 档案编辑从 admin 移到 star 端，明星本人 / 经纪团队自维护。
 * 平台运营字段（isHot / pricingTier / quota / pricing）不在此 —— 不开放给明星端。
 * avatar / cover 留空 = 不变更。
 */
public record StarProfileUpdateRequestDto(
        String name,
        String category,
        String description,
        String bio,
        String location,
        Long fans,
        String avatar,
        String cover
) {
}
