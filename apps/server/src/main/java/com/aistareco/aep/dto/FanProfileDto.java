package com.aistareco.aep.dto;

public record FanProfileDto(
        String name,
        int level,
        int exp,
        int maxExp,
        int badges,
        int nfts,
        int following,
        String totalListens,
        String joinDate
) {}
