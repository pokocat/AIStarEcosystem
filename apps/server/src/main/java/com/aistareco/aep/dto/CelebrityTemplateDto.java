package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityTemplate;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityTemplate}.
 *
 * v0.4：新增 previewCover/previewVideoUrl/durationSec —— admin 后台上传整段效果预览，
 * 小程序生成器点缩略图弹层播放。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CelebrityTemplateDto(
        String id,
        String name,
        String style,
        String description,
        String recommendedEngine,
        String recommendedPrice,
        boolean isHot,
        String plays,
        String conversionRate,
        String fitHint,
        List<Map<String, Object>> previews,
        // ── v0.4 ────────────────────────────────────────────
        String previewCover,
        String previewVideoUrl,
        Integer durationSec,
        // ── v0.34 ───────────────────────────────────────────
        boolean isFactory,
        String ownerScope,
        String ownerUserId
) {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> ARR_T = new TypeReference<>() {};

    public static CelebrityTemplateDto from(CelebrityTemplate t) {
        return new CelebrityTemplateDto(
                t.getId(), t.getName(), t.getStyle(), t.getDescription(),
                t.getRecommendedEngine(), t.getRecommendedPrice(),
                t.isHot(), t.getPlays(), t.getConversionRate(), t.getFitHint(),
                readArr(t.getPreviewsJson()),
                t.getPreviewCover(),
                t.getPreviewVideoUrl(),
                t.getDurationSec(),
                t.isFactory(),
                t.getOwnerScope(),
                t.getOwnerUserId()
        );
    }

    private static List<Map<String, Object>> readArr(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return OM.readValue(json, ARR_T);
        } catch (Exception e) {
            return List.of();
        }
    }
}
