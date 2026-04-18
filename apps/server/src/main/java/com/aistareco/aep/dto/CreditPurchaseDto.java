package com.aistareco.aep.dto;

import com.aistareco.aep.model.CreditPurchase;

import java.time.Instant;

public record CreditPurchaseDto(
        String id,
        String userId,
        String packId,
        long priceCents,
        long creditsAdded,
        Instant createdAt
) {
    public static CreditPurchaseDto from(CreditPurchase p) {
        return new CreditPurchaseDto(
                p.getId(), p.getUserId(), p.getPackId(),
                p.getPriceCents(), p.getCreditsAdded(), p.getCreatedAt()
        );
    }
}
