package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityStar;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityStar}.
 * 嵌套对象（authorization / stats / sampleVideos / pricing / photos / videos）
 * 从实体的 JSON 列反序列化。
 *
 * v0.4：新增详情扩展字段（bio/location/fans/cooperationCount/avgGmv/photos/videos），
 * 以及 from(star, override) 重载，允许把 CelebrityStarAuthorization 注入 authorization 字段
 * （登录用户的真实授权一律走该 override，匿名预览继续用 star.authorizationJson 默认值）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
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
        List<Map<String, Object>> pricing,
        // ── v0.4 ────────────────────────────────────────────
        String bio,
        String location,
        Long fans,
        Integer cooperationCount,
        Long avgGmv,
        List<Map<String, Object>> photos,
        List<Map<String, Object>> videos
) {
    private static final ObjectMapper OM = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> OBJ_T = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> ARR_T = new TypeReference<>() {};

    public static CelebrityStarDto from(CelebrityStar s) {
        return from(s, null);
    }

    /**
     * @param authOverride 当前登录用户对该明星的授权（来自 CelebrityStarAuthorization 表）；
     *                     非 null 时覆盖 star.authorizationJson 的"陈列态默认"。
     */
    public static CelebrityStarDto from(CelebrityStar s, CelebrityStarAuthorization authOverride) {
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
                authOverride != null ? authToMap(authOverride) : readObj(s.getAuthorizationJson()),
                readObj(s.getStatsJson()),
                readArr(s.getSampleVideosJson()),
                readArr(s.getPricingJson()),
                s.getBio(),
                s.getLocation(),
                s.getFans(),
                s.getCooperationCount(),
                s.getAvgGmv(),
                readArr(s.getPhotosJson()),
                readArr(s.getVideosJson())
        );
    }

    /**
     * 把 CelebrityStarAuthorization 实体打成与前端 CelebrityAuthorization 一致的 map。
     * 字段名严格遵循 apps/web/src/types/celebrity-zone.ts CelebrityAuthorization。
     */
    private static Map<String, Object> authToMap(CelebrityStarAuthorization a) {
        Map<String, Object> m = new HashMap<>();
        m.put("status", a.getStatus().wire());
        m.put("scenes", a.getScenes() != null ? a.getScenes() : List.of());
        if (a.getExpireDate() != null) {
            m.put("expireDate", a.getExpireDate().toString());
        }
        m.put("availableStyles", a.getAvailableStyles() != null ? a.getAvailableStyles() : 0);
        if (a.getPendingNote() != null) m.put("pendingNote", a.getPendingNote());
        if (a.getApplyUrl() != null) m.put("applyUrl", a.getApplyUrl());
        return m;
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
