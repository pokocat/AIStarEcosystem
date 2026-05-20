package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;

/**
 * v0.15+: POST /api/me/mixcut/publish-batch
 *
 * 把混剪产出的 N 个变体 × M 个发布目标，一次性派单（N×M 条 PublishJob）。
 *
 * outputs[].cdnUrl 必填（用 cdn_url 作 PublishJob.videoUrl；本地 fileUrl 不通过外网发布）。
 * 任一 output 缺 cdnUrl → 该项进 failedItems，不影响其他 output。
 *
 * 字段命名沿 mixcut snake_case 风格（JsonProperty 显式映射）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutPublishBatchRequest(
        @JsonProperty("source_mixcut_job_id") String sourceMixcutJobId,
        @JsonProperty("outputs") List<OutputItem> outputs,
        @JsonProperty("title") String title,
        @JsonProperty("description") String description,
        @JsonProperty("tags") List<String> tags,
        @JsonProperty("cover_url") String coverUrl,
        @JsonProperty("targets") List<TargetItem> targets,
        /** 可选 projectId；缺省时 service 端兜底为 "mixcut-batch-<sourceMixcutJobId>" */
        @JsonProperty("project_id") String projectId
) {

    /** 一个 mixcut 变体。outputId 用于失败回传定位；cdnUrl 是真值（必填）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OutputItem(
            @JsonProperty("output_id") String outputId,
            @JsonProperty("cdn_url") String cdnUrl,
            @JsonProperty("thumbnail_url") String thumbnailUrl
    ) {}

    /** 与 CreatePublishJobInputDto.Target 同构，复用 platform / socialAccountId / scheduledAt 三字段。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TargetItem(
            @JsonProperty("platform") String platform,
            @JsonProperty("social_account_id") String socialAccountId,
            @JsonProperty("scheduled_at") Instant scheduledAt
    ) {}
}
