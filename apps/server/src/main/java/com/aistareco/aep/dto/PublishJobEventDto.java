package com.aistareco.aep.dto;

import com.aistareco.aep.model.PublishJobEvent;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * 发布任务事件流读 DTO（admin 审计视图）。
 *
 * 字段名 mirror packages/types/src/publish-job.ts PublishJobEvent。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PublishJobEventDto(
        String id,
        String jobId,
        String kind,
        String fromStatus,
        String toStatus,
        Integer progress,
        String note,
        Instant at
) {
    public static PublishJobEventDto from(PublishJobEvent e) {
        return new PublishJobEventDto(
                e.getId(),
                e.getJobId(),
                e.getKind(),
                e.getFromStatus() != null ? e.getFromStatus().wire() : null,
                e.getToStatus() != null ? e.getToStatus().wire() : null,
                e.getProgress(),
                e.getNote(),
                e.getAt()
        );
    }
}
