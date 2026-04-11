package com.aistareco.dto;

import java.util.List;

/** Matches TypeScript OfficialIpTemplate. */
public record OfficialIpTemplateDto(
        String id,
        String name,
        String avatarUrl,
        String style,
        String rarity,
        List<String> tags,
        PersonaParamsDto preset
) {}
