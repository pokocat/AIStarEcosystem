package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 明星档案 DTO（v0.60 web-star）。字段名与 packages/types/src/star-workbench.ts
 * StarProfile 完全一致。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarProfileDto(
        String starId,
        String name,
        String avatar,
        String category,
        String tierLabel,
        long fans,
        boolean agentView,
        String listedAt
) {
}
