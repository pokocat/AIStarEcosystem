package com.aistareco.aep.dto;

public record NFTItemDto(
        String id,
        String name,
        String artist,
        String preview,
        String price,
        String rarity,
        int holders
) {}
