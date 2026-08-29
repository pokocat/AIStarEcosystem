package com.aistareco.aep.dap.dto;

import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityStar;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 资产中枢 P2 ·「授权给我的明星形象」只读投影（= TS StarGrant）。
 *
 * 真值仍在 celebrity 域（celebrity_star_authorizations + celebrity_stars），
 * 中枢按联邦原则只投影不搬家（docs/aiavatar-asset-hub-redesign.md §1 铁律 2）。
 * 申请与审批继续走 web-celebrity / web-star 既有链路，本 DTO 只面向货架与授权中心展示。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DapStarGrantDto(
        String id,
        String starId,
        String starName,
        String starAvatar,
        String category,
        List<String> scenes,
        String status,
        String expireDate,
        Integer availableStyles,
        String appliedAt,
        /** 状态最近一次变化时间（实体只有 updatedAt，没有独立的"批准时刻"，命名如实）。 */
        String statusUpdatedAt
) {
    public static DapStarGrantDto from(CelebrityStarAuthorization a, CelebrityStar star) {
        boolean decided = a.getStatus() != CelebrityAuthStatus.PENDING;
        return new DapStarGrantDto(
                a.getId(),
                a.getStarId(),
                star != null ? star.getName() : "未知明星",
                star != null ? star.getAvatar() : null,
                star != null ? star.getCategory() : null,
                a.getScenes() != null ? a.getScenes() : List.of(),
                a.getStatus().wire(),
                a.getExpireDate() != null ? a.getExpireDate().toString() : null,
                a.getAvailableStyles(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : null,
                decided && a.getUpdatedAt() != null ? a.getUpdatedAt().toString() : null
        );
    }
}
