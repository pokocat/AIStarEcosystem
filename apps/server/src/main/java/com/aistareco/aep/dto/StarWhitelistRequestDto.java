package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarWhitelistRequest;
import com.fasterxml.jackson.annotation.JsonInclude;

/** 报白申请 DTO（= TS StarWhitelistRequest）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarWhitelistRequestDto(
        String id,
        String mcnName,
        String accountHandle,
        String accountId,
        String phone,
        String uid,
        String platform,
        long fans,
        int accountAgeMonths,
        String mcnLevel,
        String requestedAt,
        StarWhitelistRequest.Status status,
        StarWhitelistRequest.Step whitelistStep,
        String message,
        int recentVideos,
        long avgViews,
        int creditScore
) {
    public static StarWhitelistRequestDto from(StarWhitelistRequest r) {
        return new StarWhitelistRequestDto(
                r.getId(),
                r.getMcnName(),
                r.getAccountHandle(),
                r.getAccountId(),
                r.getPhone(),
                r.getUid(),
                r.getPlatform(),
                r.getFans(),
                r.getAccountAgeMonths(),
                r.getMcnLevel(),
                r.getRequestedAt() != null ? r.getRequestedAt().toString() : null,
                r.getStatus(),
                r.getWhitelistStep(),
                r.getMessage(),
                r.getRecentVideos(),
                r.getAvgViews(),
                r.getCreditScore()
        );
    }
}
