package com.aistareco.dto;

import java.util.List;

/** Matches TypeScript SingerWorkspacePayload — returned by GET /api/singers/my. */
public record SingerWorkspacePayload(
        List<SingerDetailDto>      singers,
        List<OfficialIpTemplateDto> officialIpTemplates,
        List<PersonaPresetDto>     personaPresets,
        List<WardrobeItemDto>      wardrobeCatalog,
        List<PosePresetDto>        poseCatalog,
        List<ExpressionPresetDto>  expressionCatalog,
        List<GesturePresetDto>     gestureCatalog
) {}
