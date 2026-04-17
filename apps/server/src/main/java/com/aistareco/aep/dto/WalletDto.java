package com.aistareco.aep.dto;

import com.aistareco.aep.model.Wallet;

import java.time.Instant;

public record WalletDto(
        String id,
        String userId,
        long totalBalance,
        long licenseBalance,
        long rechargeBalance,
        long giftBalance,
        long pendingBalance,
        Instant createdAt,
        Instant updatedAt
) {
    public static WalletDto from(Wallet w) {
        return new WalletDto(
                w.getId(), w.getUserId(),
                w.getTotalBalance(), w.getLicenseBalance(),
                w.getRechargeBalance(), w.getGiftBalance(),
                w.getPendingBalance(),
                w.getCreatedAt(), w.getUpdatedAt()
        );
    }
}
