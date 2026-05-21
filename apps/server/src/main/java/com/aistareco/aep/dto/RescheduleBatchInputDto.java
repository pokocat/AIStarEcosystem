package com.aistareco.aep.dto;

import com.aistareco.aep.dto.MixcutPublishBatchRequest.ScheduleSpec;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * v0.22: POST /api/me/publish-jobs/batches/{projectId}/reschedule 请求体。
 *
 * 复用 MixcutPublishBatchRequest.ScheduleSpec —— immediate / single / daily_recurring
 * 三种 strategy。服务端 PublishJobBatchService.rescheduleBatch 只对 status=QUEUED
 * 的子集生效；其他状态原样保留。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RescheduleBatchInputDto(
        @JsonProperty("schedule") ScheduleSpec schedule
) {}
