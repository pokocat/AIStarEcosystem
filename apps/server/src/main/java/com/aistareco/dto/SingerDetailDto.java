package com.aistareco.dto;

import java.util.List;

/**
 * Matches TypeScript SingerDetail interface (extends SingerSummary).
 */
public record SingerDetailDto(
        String id,
        String name,
        String style,
        String status,
        String avatarUrl,
        String quality,
        String createdAt,
        int songsCount,
        int fansCount,
        int popularity,
        List<String> tags,
        PersonaParamsDto parameters
) {}
