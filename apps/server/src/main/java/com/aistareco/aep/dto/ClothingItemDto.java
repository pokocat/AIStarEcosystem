package com.aistareco.aep.dto;

import com.aistareco.model.WardrobeItem;

import java.util.List;

/**
 * Wire-format for {@link com.aistareco.model.WardrobeItem}.
 * 字段镜像前端 {@code types/wardrobe.ts:ClothingItem}（name 取 zh，rarity/category 原样下发）。
 */
public record ClothingItemDto(
        String id,
        String name,
        String category,
        String imageUrl,
        String rarity,
        int price,
        List<String> tags,
        boolean isLocked,
        boolean isNew,
        boolean isTrending,
        int priceCredits,
        String saleStatus,
        String previewUrl,
        boolean owned
) {
    public static ClothingItemDto from(WardrobeItem w) {
        return from(w, false);
    }

    public static ClothingItemDto from(WardrobeItem w, boolean owned) {
        String name = w.getNameZh() != null && !w.getNameZh().isBlank()
                ? w.getNameZh() : w.getNameEn();
        String saleStatus = w.getSaleStatus() == null
                ? WardrobeItem.SaleStatus.FREE.name() : w.getSaleStatus().name();
        return new ClothingItemDto(
                w.getId(), name, w.getCategory(), w.getImageUrl(),
                w.getRarity(), w.getPrice(), w.getTags(),
                w.isLocked(), w.isNewItem(), w.isTrending(),
                w.getPriceCredits(), saleStatus, w.getPreviewUrl(), owned
        );
    }
}
