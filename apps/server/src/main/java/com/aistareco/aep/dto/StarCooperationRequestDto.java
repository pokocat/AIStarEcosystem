package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 带货授权申请 DTO（= TS StarCooperationRequest）。
 * 后端实体即 celebrity 域 CelebrityStarAuthorization —— web-celebrity 创作者
 * 发起授权申请（PENDING）后流转到 web-star 明星端审批，这是双端打通的核心对象。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record StarCooperationRequestDto(
        String id,
        String applicantUserId,
        String applicantName,
        List<String> scenes,
        String note,
        String status,
        String requestedAt,
        String decidedAt,
        String expireDate,
        Integer availableStyles
) {
    public static StarCooperationRequestDto from(CelebrityStarAuthorization a, String applicantName) {
        boolean decided = a.getStatus() != com.aistareco.aep.model.CelebrityAuthStatus.PENDING;
        return new StarCooperationRequestDto(
                a.getId(),
                a.getUserId(),
                applicantName,
                a.getScenes() != null ? a.getScenes() : List.of(),
                a.getApplicantNote(),
                a.getStatus().wire(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : null,
                decided && a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : null,
                a.getExpireDate() != null ? a.getExpireDate().toString() : null,
                a.getAvailableStyles()
        );
    }
}
