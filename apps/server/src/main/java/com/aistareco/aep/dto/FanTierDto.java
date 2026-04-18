package com.aistareco.aep.dto;

import com.aistareco.aep.model.FanTier;

public record FanTierDto(
        String name,
        String icon,
        int count,
        String color,
        String bg
) {
    public static FanTierDto from(FanTier t) {
        return new FanTierDto(
                t.getName(), t.getIcon(), t.getCount(),
                t.getColor(), t.getBg()
        );
    }
}
