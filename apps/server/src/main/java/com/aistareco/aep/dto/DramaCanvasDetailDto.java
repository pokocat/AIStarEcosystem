package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * 画布详情（v0.198）= {@code DramaCanvasSummary} 的全部字段 + {@code doc} + {@code docVersion}
 * （TS {@code DramaCanvasDetail extends DramaCanvasSummary}；record 不能继承，字段平铺，名字 1:1）。
 *
 * <p>{@code doc} 已给属于本人的 key 派生好 {@code url} / {@code lastFrameUrl}；不是本人的 key 不签（前端显示占位）。
 * {@code docVersion} 保存和每个生成请求都原样带回。
 *
 * <p>{@code splitNotes} 只在「粘贴写好的剧本」新建（POST，source=paste）那次响应里有（切集说明，空就不带）；
 * GET 详情一律为 null，经 {@code NON_NULL} 不出现在 wire 上。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DramaCanvasDetailDto(
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
        String updatedAt,
        JsonNode doc,
        String docVersion,
        List<String> splitNotes
) {
}
