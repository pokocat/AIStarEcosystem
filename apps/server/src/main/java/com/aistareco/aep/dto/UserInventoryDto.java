package com.aistareco.aep.dto;

import com.aistareco.aep.model.UserInventory;

import java.time.Instant;

public record UserInventoryDto(
        String id,
        String userId,
        String itemType,
        String itemId,
        String source,
        int creditsSpent,
        String ledgerEntryId,
        Instant acquiredAt
) {
    public static UserInventoryDto from(UserInventory inv) {
        return new UserInventoryDto(
                inv.getId(),
                inv.getUserId(),
                inv.getItemType() == null ? null : inv.getItemType().name(),
                inv.getItemId(),
                inv.getSource() == null ? null : inv.getSource().name(),
                inv.getCreditsSpent(),
                inv.getLedgerEntryId(),
                inv.getAcquiredAt()
        );
    }
}
