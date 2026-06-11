package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarInfringementCase;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 侵权案例 DTO（= TS StarInfringementCase）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarInfringementCaseDto(
        String id,
        String platform,
        String url,
        String ipName,
        StarInfringementCase.Severity severity,
        StarInfringementCase.Status status,
        String reportedBy,
        String reportedAt,
        String description,
        String actionNote
) {
    public static StarInfringementCaseDto from(StarInfringementCase c) {
        return new StarInfringementCaseDto(
                c.getId(),
                c.getPlatform(),
                c.getUrl(),
                c.getIpName(),
                c.getSeverity(),
                c.getStatus(),
                c.getReportedBy(),
                c.getReportedAt() != null ? c.getReportedAt().toString() : null,
                c.getDescription(),
                c.getActionNote()
        );
    }
}
