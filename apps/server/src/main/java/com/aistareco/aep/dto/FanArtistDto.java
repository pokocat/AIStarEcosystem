package com.aistareco.aep.dto;

import java.util.List;

public record FanArtistDto(
        String id,
        String name,
        String type,
        String avatar,
        String fans,
        boolean trending,
        List<String> tags
) {}
