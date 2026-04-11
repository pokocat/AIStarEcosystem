package com.aistareco.dto;

import java.util.List;
import java.util.Map;

/** Matches TypeScript TrackWorkspacePayload — returned by GET /api/tracks/my. */
public record TrackWorkspacePayload(
        List<TrackSummaryDto>         tracks,
        List<ChartEntryDto>           chartEntries,
        List<Map<String, Object>>     lyrics,
        Map<String, Object>           discoverySpotlight,
        List<Map<String, Object>>     recommendations,
        List<String>                  generationStages
) {}
