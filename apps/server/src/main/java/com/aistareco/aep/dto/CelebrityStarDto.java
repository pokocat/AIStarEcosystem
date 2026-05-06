package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityStar;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityStar}.
 * 嵌套对象（authorization / stats / sampleVideos / pricing）从实体的 JSON 列反序列化。
 */
public record CelebrityStarDto(
        String id,
        String name,
        String avatar,
        String cover,
        String category,
        List<String> subCategories,
        boolean isHot,
        String description,
        String startingPrice,
        String pricingTier,
        Integer quotaUsed,
        Integer quotaTotal,
        Map<String, Object> authorization,
        Map<String, Object> stats,
        List<Map<String, Object>> sampleVideos,
        List<Map<String, Object>> pricing
) {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> OBJ_T = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> ARR_T = new TypeReference<>() {};

    public static CelebrityStarDto from(CelebrityStar s) {
        return new CelebrityStarDto(
                s.getId(),
                s.getName(),
                s.getAvatar(),
                s.getCover(),
                s.getCategory(),
                s.getSubCategories() != null ? s.getSubCategories() : List.of(),
                s.isHot(),
                s.getDescription(),
                s.getStartingPrice(),
                s.getPricingTier(),
                s.getQuotaUsed(),
                s.getQuotaTotal(),
                readObj(s.getAuthorizationJson()),
                readObj(s.getStatsJson()),
                readArr(s.getSampleVideosJson()),
                readArr(s.getPricingJson())
        );
    }

    private static Map<String, Object> readObj(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return OM.readValue(json, OBJ_T);
        } catch (Exception e) {
            return Map.of();
        }
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
