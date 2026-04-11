package com.aistareco.dto;

import java.util.List;
import java.util.Map;

/** Matches TypeScript AnalyticsDashboardPayload. */
public record AnalyticsDashboardPayload(
        Map<String, Object>           producerMetrics,
        Map<String, Object>           coachMetrics,
        List<Map<String, Object>>     earningsSeries,
        List<Map<String, Object>>     transactions,
        List<MarketplaceListingDto>   marketListings,
        List<Map<String, Object>>     coachTrainees,
        Map<String, Object>           distribution
) {}
