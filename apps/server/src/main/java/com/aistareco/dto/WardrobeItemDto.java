package com.aistareco.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Matches TypeScript WardrobeItem. Boolean optional fields use JsonProperty for exact naming. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WardrobeItemDto(
        String id,
        String name,
        String category,
        String imageUrl,
        String rarity,
        int price,
        List<String> tags,
        @JsonProperty("isLocked")  Boolean isLocked,
        @JsonProperty("isNew")     Boolean isNew,
        @JsonProperty("isTrending") Boolean isTrending
) {}
