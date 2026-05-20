package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * v0.15+: publish-batch 的响应。
 *
 * 部分成功语义：返回 200 但 failedItems 数组非空时表示有变体未派单。
 * 调用方按 failedItems.length 决定 toast / 状态展示。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutPublishBatchResultDto(
        @JsonProperty("success_jobs") List<PublishJobDto> successJobs,
        @JsonProperty("failed_items") List<FailedItem> failedItems,
        @JsonProperty("total_requested") int totalRequested
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FailedItem(
            @JsonProperty("output_id") String outputId,
            @JsonProperty("reason") String reason,
            @JsonProperty("detail") String detail
    ) {}
}
