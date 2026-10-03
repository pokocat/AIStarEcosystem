package com.aistareco.aep.dto;

/**
 * 保存画布的结果（v0.198）：TS {@code SaveDramaCanvasResult} 1:1。
 * {@code docVersion} 是刚落库那份文档的指纹，下次保存带它当 {@code baseDocVersion}；{@code updatedAt} 为 ISO 8601，
 * 与之后 GET 读回来的值逐字相同（落库前已截到微秒）。
 */
public record SaveDramaCanvasResultDto(
        String docVersion,
        String updatedAt
) {
}
