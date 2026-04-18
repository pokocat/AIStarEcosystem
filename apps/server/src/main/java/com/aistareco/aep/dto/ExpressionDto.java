package com.aistareco.aep.dto;

import com.aistareco.model.Expression;
import com.aistareco.model.WardrobeItem;

public record ExpressionDto(
        String id,
        String name,
        String emoji,
        int intensity,
        String category,
        int priceCredits,
        String saleStatus,
        String previewUrl,
        boolean owned
) {
    public static ExpressionDto from(Expression e) {
        return from(e, false);
    }

    public static ExpressionDto from(Expression e, boolean owned) {
        String name = e.getNameZh() != null && !e.getNameZh().isBlank()
                ? e.getNameZh() : e.getNameEn();
        String saleStatus = e.getSaleStatus() == null
                ? WardrobeItem.SaleStatus.FREE.name() : e.getSaleStatus().name();
        return new ExpressionDto(
                e.getId(), name, e.getEmoji(), e.getIntensity(), e.getCategory(),
                e.getPriceCredits(), saleStatus, e.getPreviewUrl(), owned
        );
    }
}
