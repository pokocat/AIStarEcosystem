package com.aistareco.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Matches TypeScript PosePreset. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PosePresetDto(
        String id,
        String name,
        String category,
        String thumbnail,
        String difficulty,
        @JsonProperty("isLocked") Boolean isLocked,
        @JsonProperty("isNew")    Boolean isNew
) {}
