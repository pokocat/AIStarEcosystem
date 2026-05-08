package com.aistareco.aep.dto;

/**
 * 单条 video append 请求体。对齐 apps/web/src/types/celebrity-zone.ts CelebrityStarVideo。
 */
public record AdminCelebrityStarVideoUpsertDto(
        String id,
        String title,
        Integer durationSec,
        String coverUrl,
        String playUrl,
        String tag
) {}
