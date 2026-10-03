package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * 画布上的一次生成（v0.198）：TS {@code DramaCanvasRun} 1:1（packages/types/src/drama-canvas.ts，AGENTS.md §4.1）。
 *
 * <p>{@code result} 是 TS {@code DramaCanvasRunResult}（按 kind 只有其中一块）。库里只存 key；出 wire 时
 * 由 {@code DramaCanvasRunService} 只给<b>属于本人</b>的 key 派生签名 {@code url} / {@code lastFrameUrl}。
 * 时间一律 ISO 8601（§4.8）。
 *
 * <p>同文件还放了各生成接口的请求体，名字与 TS 同名（{@code CanvasScriptRunBody} …），免得一组 1:1 的契约散落成十个文件。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DramaCanvasRunDto(
        String id,
        String canvasId,
        /** script | extract | image | storyboard | video | assemble */
        String kind,
        String target,
        /** queued | running | succeeded | failed | canceled */
        String status,
        long cost,
        JsonNode result,
        Refs refs,
        String errorCode,
        String errorMessage,
        String createdAt,
        String finishedAt
) {

    /** TS {@code DramaCanvasRun.refs}：参考图实际送到模型的情况。 */
    public record Refs(int requested, int applied, List<String> notes) {}

    // ── 请求体（TS 同名）──────────────────────────────────────────────────────────

    /** TS {@code CanvasScriptRunBody}。 */
    public record CanvasScriptRunBody(String clientRequestId, String docVersion,
                                      /** setting | outline | episode */
                                      String stage, Integer episodeNo, String instruction) {}

    /** TS {@code CanvasExtractRunBody}（= CanvasRunBase）。 */
    public record CanvasExtractRunBody(String clientRequestId, String docVersion) {}

    /** TS {@code CanvasImageTarget}：kind = look | scene | material（带 id）| segment（带 episodeNo + segmentId）。 */
    public record CanvasImageTarget(String kind, String id, Integer episodeNo, String segmentId) {}

    /** TS {@code CanvasImageRunBody}。 */
    public record CanvasImageRunBody(String clientRequestId, String docVersion, CanvasImageTarget target,
                                     Integer count, String ratio, String endpointId) {}

    /** TS {@code CanvasImageBatchBody.items[]}。 */
    public record CanvasImageBatchItem(CanvasImageTarget target, Integer count, String ratio) {}

    /** TS {@code CanvasImageBatchBody}。 */
    public record CanvasImageBatchBody(String clientRequestId, String docVersion, List<CanvasImageBatchItem> items,
                                       String endpointId) {}

    /** TS {@code CanvasStoryboardRunBody}。 */
    public record CanvasStoryboardRunBody(String clientRequestId, String docVersion, Integer episodeNo,
                                          Integer maxSegmentSec) {}

    /** TS {@code CanvasVideoRunBody}。 */
    public record CanvasVideoRunBody(String clientRequestId, String docVersion, Integer episodeNo, String segmentId,
                                     String endpointId, Boolean useFirstFrame) {}

    /** TS {@code CanvasAssembleRunBody}。 */
    public record CanvasAssembleRunBody(String clientRequestId, String docVersion, Integer episodeNo) {}
}
