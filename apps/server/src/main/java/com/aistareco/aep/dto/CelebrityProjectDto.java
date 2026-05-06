package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityProject;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityProject}.
 */
public record CelebrityProjectDto(
        String id,
        String name,
        String starId,
        String starName,
        String starAvatar,
        String status,
        int videoCount,
        String totalPlays,
        String totalInteractions,
        int conversions,
        String gmv,
        LocalDate createdAt,
        String pricingTier,
        List<Map<String, Object>> channels,
        Quota quota
) {
    public record Quota(int used, int total) {}

    private static final ObjectMapper OM = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> ARR_T = new TypeReference<>() {};

    public static CelebrityProjectDto from(CelebrityProject p) {
        return new CelebrityProjectDto(
                p.getId(),
                p.getName(),
                p.getStarId(),
                p.getStarName(),
                p.getStarAvatar(),
                p.getStatus(),
                p.getVideoCount(),
                p.getTotalPlays(),
                p.getTotalInteractions(),
                p.getConversions(),
                p.getGmv(),
                p.getCreatedAt(),
                p.getPricingTier(),
                readArr(p.getChannelsJson()),
                new Quota(p.getQuotaUsed(), p.getQuotaTotal())
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
