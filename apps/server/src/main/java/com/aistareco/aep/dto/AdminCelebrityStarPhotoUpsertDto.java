package com.aistareco.aep.dto;

/**
 * 单条 photo append 请求体。对齐 apps/web/src/types/celebrity-zone.ts CelebrityStarPhoto。
 * id 可由 admin 指定（运营自行编号）或留空由 service 生成。
 */
public record AdminCelebrityStarPhotoUpsertDto(
        String id,
        String url,
        String caption
) {}
