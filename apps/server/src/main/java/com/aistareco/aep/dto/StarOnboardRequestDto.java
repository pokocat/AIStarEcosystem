package com.aistareco.aep.dto;

/** 明星入驻请求体（= TS StarOnboardInput）。 */
public record StarOnboardRequestDto(
        String name,
        String category,
        String description,
        String bio,
        String location,
        Long fans,
        Integer startingPriceCents,
        Boolean agentView
) {
}
