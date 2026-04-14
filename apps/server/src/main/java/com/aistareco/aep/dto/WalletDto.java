package com.aistareco.aep.dto;

import com.aistareco.aep.model.Wallet;

import java.time.Instant;

public record WalletDto(
        String id,
        String tenantId,
        long totalBalance,
        long giftBalance,
        long rechargeBalance,
        long planBalance,
        Instant createdAt,
        Instant updatedAt
) {
    public static WalletDto from(Wallet w) {
        return new WalletDto(
                w.getId(), w.getTenantId(),
                w.getTotalBalance(), w.getGiftBalance(),
                w.getRechargeBalance(), w.getPlanBalance(),
                w.getCreatedAt(), w.getUpdatedAt()
        );
    }
}
