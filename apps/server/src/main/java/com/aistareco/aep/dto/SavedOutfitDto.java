package com.aistareco.aep.dto;

import com.aistareco.aep.model.SavedOutfit;

import java.time.Instant;
import java.util.Map;

public record SavedOutfitDto(
        String id,
        String userId,
        String name,
        Map<String, Object> slots,
        Instant createdAt
) {
    public static SavedOutfitDto from(SavedOutfit o) {
        return new SavedOutfitDto(
                o.getId(), o.getUserId(), o.getName(),
                o.getSlotsJson(), o.getCreatedAt()
        );
    }
}
