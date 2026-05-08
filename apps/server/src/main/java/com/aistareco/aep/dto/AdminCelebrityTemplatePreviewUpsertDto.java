package com.aistareco.aep.dto;

/**
 * 仅更新 CelebrityTemplate 预览字段的轻量请求体。
 * 与 PUT /api/admin/celebrity/templates/{id}/preview 对应。
 */
public record AdminCelebrityTemplatePreviewUpsertDto(
        String previewCover,
        String previewVideoUrl,
        Integer durationSec
) {}
