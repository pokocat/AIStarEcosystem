package com.aistareco.aep.dto;

import com.aistareco.model.Pose;
import com.aistareco.model.WardrobeItem;

public record PoseDto(
        String id,
        String name,
        String category,
        String thumbnail,
        String difficulty,
        boolean isLocked,
        boolean isNew,
        int priceCredits,
        String saleStatus,
        String previewUrl,
        boolean owned
) {
    public static PoseDto from(Pose p) {
        return from(p, false);
    }

    public static PoseDto from(Pose p, boolean owned) {
        String name = p.getNameZh() != null && !p.getNameZh().isBlank()
                ? p.getNameZh() : p.getNameEn();
        String saleStatus = p.getSaleStatus() == null
                ? WardrobeItem.SaleStatus.FREE.name() : p.getSaleStatus().name();
        return new PoseDto(
                p.getId(), name, p.getCategory(), p.getThumbnail(),
                p.getDifficulty(), p.isLocked(), p.isNewItem(),
                p.getPriceCredits(), saleStatus, p.getPreviewUrl(), owned
        );
    }
}
