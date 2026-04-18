package com.aistareco.aep.dto;

import com.aistareco.model.Gesture;
import com.aistareco.model.WardrobeItem;

public record GestureDto(
        String id,
        String name,
        String icon,
        String category,
        int priceCredits,
        String saleStatus,
        String previewUrl,
        boolean owned
) {
    public static GestureDto from(Gesture g) {
        return from(g, false);
    }

    public static GestureDto from(Gesture g, boolean owned) {
        String name = g.getNameZh() != null && !g.getNameZh().isBlank()
                ? g.getNameZh() : g.getNameEn();
        String saleStatus = g.getSaleStatus() == null
                ? WardrobeItem.SaleStatus.FREE.name() : g.getSaleStatus().name();
        return new GestureDto(g.getId(), name, g.getIcon(), g.getCategory(),
                g.getPriceCredits(), saleStatus, g.getPreviewUrl(), owned);
    }
}
