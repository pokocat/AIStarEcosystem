package com.aistareco.aep.dto;

import com.aistareco.aep.model.FanGrowthPoint;

public record FanGrowthPointDto(
        String date,
        long fans,
        long active
) {
    public static FanGrowthPointDto from(FanGrowthPoint p) {
        return new FanGrowthPointDto(
                p.getDateLabel(), p.getFans(), p.getActive()
        );
    }
}
