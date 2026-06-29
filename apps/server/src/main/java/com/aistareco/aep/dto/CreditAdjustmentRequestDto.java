package com.aistareco.aep.dto;

import com.aistareco.aep.model.CreditAdjustmentRequest;

import java.time.Instant;
import java.util.Locale;

/** 大额调差/赠送审批单（v2 §9.2）。enum 出 wire 全小写。 */
public record CreditAdjustmentRequestDto(
        String id,
        String type,
        String targetUserId,
        long amount,
        String reason,
        String incidentRef,
        String campaignId,
        String status,
        String makerId,
        String checkerId,
        String ledgerEntryId,
        String decideNote,
        Instant createdAt,
        Instant decidedAt
) {
    public static CreditAdjustmentRequestDto from(CreditAdjustmentRequest r) {
        return new CreditAdjustmentRequestDto(
                r.getId(), lower(r.getType()), r.getTargetUserId(), r.getAmount(), r.getReason(),
                r.getIncidentRef(), r.getCampaignId(), lower(r.getStatus()), r.getMakerId(),
                r.getCheckerId(), r.getLedgerEntryId(), r.getDecideNote(),
                r.getCreatedAt(), r.getDecidedAt());
    }

    private static String lower(Enum<?> e) {
        return e == null ? null : e.name().toLowerCase(Locale.ROOT);
    }
}
