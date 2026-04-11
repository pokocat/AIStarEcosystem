package com.aistareco.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Matches TypeScript NftCollectionSummary. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NftCollectionSummaryDto(
        String id,
        String name,
        String coverUrl,
        String priceLabel,
        int    remaining,
        String rarity,
        String trackId
) {}
