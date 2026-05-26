package com.aistareco.aep.dto;

import java.util.List;
import java.util.Map;

/**
 * admin POST/PUT /api/admin/celebrity/templates[/{id}] 请求体。
 * 字段集对齐 apps/web/src/types/celebrity-zone.ts CelebrityTemplate。
 *
 * preview 字段（previewCover/previewVideoUrl/durationSec）可在此处一并提交，也可走专用 PUT /{id}/preview。
 */
public record AdminCelebrityTemplateUpsertDto(
        String id,
        String name,
        String style,
        String description,
        String recommendedEngine,
        String recommendedPrice,
        Boolean isHot,
        String plays,
        String conversionRate,
        String fitHint,
        List<Map<String, Object>> previews,
        // ── v0.4 字段 ────────────────────────────────────────
        String previewCover,
        String previewVideoUrl,
        Integer durationSec,
        // ── v0.34 字段：工厂/用户模板归属 ────────────────────
        Boolean isFactory,
        String ownerScope,
        String ownerUserId
) {}
