package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarContentReview;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 内容审核条目 DTO（= TS StarContentReview）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarContentReviewDto(
        String id,
        String title,
        StarContentReview.ContentType type,
        String uploader,
        String mcnName,
        int durationSec,
        String submittedAt,
        StarContentReview.Status status,
        String platform,
        Long views,
        String revisionNote
) {
    public static StarContentReviewDto from(StarContentReview r) {
        return new StarContentReviewDto(
                r.getId(),
                r.getTitle(),
                r.getType(),
                r.getUploader(),
                r.getMcnName(),
                r.getDurationSec(),
                r.getSubmittedAt() != null ? r.getSubmittedAt().toString() : null,
                r.getStatus(),
                r.getPlatform(),
                r.getViews(),
                r.getRevisionNote()
        );
    }
}
