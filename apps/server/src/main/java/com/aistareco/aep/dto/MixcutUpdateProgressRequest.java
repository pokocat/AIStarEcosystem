package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MixcutUpdateProgressRequest(
        @JsonProperty("progress") Integer progress,
        @JsonProperty("status") String status
) {
}
