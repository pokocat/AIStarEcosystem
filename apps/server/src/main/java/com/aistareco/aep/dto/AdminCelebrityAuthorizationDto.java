package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * 授权关系读 DTO。给 admin 列表/详情用；用户端永远从 CelebrityStarDto.authorization 字段消费。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminCelebrityAuthorizationDto(
        String id,
        String userId,
        String starId,
        String status,
        List<String> scenes,
        LocalDate expireDate,
        Integer availableStyles,
        String pendingNote,
        String applyUrl,
        Instant createdAt,
        Instant updatedAt
) {
    public static AdminCelebrityAuthorizationDto from(CelebrityStarAuthorization a) {
        return new AdminCelebrityAuthorizationDto(
                a.getId(),
                a.getUserId(),
                a.getStarId(),
                a.getStatus() != null ? a.getStatus().wire() : null,
                a.getScenes() != null ? a.getScenes() : List.of(),
                a.getExpireDate(),
                a.getAvailableStyles(),
                a.getPendingNote(),
                a.getApplyUrl(),
                a.getCreatedAt(),
                a.getUpdatedAt()
        );
    }
}
