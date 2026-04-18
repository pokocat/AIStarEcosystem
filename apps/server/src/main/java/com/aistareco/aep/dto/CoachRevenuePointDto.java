package com.aistareco.aep.dto;

public record CoachRevenuePointDto(
        String month,
        long streaming,
        long endorsement,
        long nft,
        long live
) {}
