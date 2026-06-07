package com.aistareco.aep.dto;

import com.aistareco.aep.model.RechargeOrder;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Locale;

/**
 * 充值订单 wire shape。
 * Frontend mirror: packages/types/src/wallet.ts {@code RechargeOrder}。
 * status 出 wire 全小写（pending / paid / rejected / cancelled）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RechargeOrderDto(
        String id,
        String userId,
        String username,
        String displayName,
        String studioName,
        String packageId,
        String packageTag,
        long credits,
        long bonusCredits,
        long priceCents,
        String status,
        String userNote,
        String reviewerId,
        String reviewNote,
        Instant createdAt,
        Instant updatedAt,
        Instant reviewedAt
) {
    public static RechargeOrderDto from(RechargeOrder o) {
        return new RechargeOrderDto(
                o.getId(),
                o.getUserId(),
                o.getUsername(),
                o.getDisplayName(),
                o.getStudioName(),
                o.getPackageId(),
                o.getPackageTag(),
                o.getCredits(),
                o.getBonusCredits(),
                o.getPriceCents(),
                o.getStatus() == null ? null : o.getStatus().name().toLowerCase(Locale.ROOT),
                o.getUserNote(),
                o.getReviewerId(),
                o.getReviewNote(),
                o.getCreatedAt(),
                o.getUpdatedAt(),
                o.getReviewedAt()
        );
    }
}
