package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 画布列表卡片（v0.198）。字段名与 {@code packages/types/src/drama-canvas.ts} 的
 * {@code DramaCanvasSummary} 1:1（AGENTS.md §4.1）。
 *
 * <p>{@code step} 由服务端按文档推：没拆过角色场景（{@code script.extractedAt} 缺）→ script；
 * 所有集都还没有片段 → assets；否则 episodes。{@code coverUrl} 是出 wire 时由挑中图的 key 派生的短期签名地址，
 * 只给本人的 key 签；没有图时缺省。时间一律 ISO 8601（§4.8）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DramaCanvasSummaryDto(
        String id,
        String title,
        String ratio,
        String step,
        int episodeCount,
        int characterCount,
        int sceneCount,
        int segmentsDone,
        int segmentsTotal,
        int episodesAssembled,
        String coverUrl,
        String createdAt,
        String updatedAt
) {
}
