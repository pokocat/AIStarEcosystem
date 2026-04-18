package com.aistareco.aep.dto;

/**
 * 商店目录统一商品视图，跨品类（wardrobe/pose/expression/gesture 等）。
 * 具体字段镜像前端 {@code types/store.ts:StoreItem}。
 */
public record StoreItemDto(
        String id,
        String itemType,
        String name,
        String category,
        String previewUrl,
        String rarity,
        int priceCredits,
        String saleStatus,
        boolean owned
) {
    public static StoreItemDto ofWardrobe(com.aistareco.model.WardrobeItem w, boolean owned) {
        String name = w.getNameZh() != null && !w.getNameZh().isBlank() ? w.getNameZh() : w.getNameEn();
        String preview = w.getPreviewUrl() != null && !w.getPreviewUrl().isBlank() ? w.getPreviewUrl() : w.getImageUrl();
        return new StoreItemDto(
                w.getId(), "WARDROBE", name, w.getCategory(), preview, w.getRarity(),
                w.getPriceCredits(),
                w.getSaleStatus() == null ? "FREE" : w.getSaleStatus().name(),
                owned
        );
    }

    public static StoreItemDto ofPose(com.aistareco.model.Pose p, boolean owned) {
        String name = p.getNameZh() != null && !p.getNameZh().isBlank() ? p.getNameZh() : p.getNameEn();
        String preview = p.getPreviewUrl() != null && !p.getPreviewUrl().isBlank() ? p.getPreviewUrl() : p.getThumbnail();
        return new StoreItemDto(
                p.getId(), "POSE", name, p.getCategory(), preview, p.getDifficulty(),
                p.getPriceCredits(),
                p.getSaleStatus() == null ? "FREE" : p.getSaleStatus().name(),
                owned
        );
    }

    public static StoreItemDto ofExpression(com.aistareco.model.Expression e, boolean owned) {
        String name = e.getNameZh() != null && !e.getNameZh().isBlank() ? e.getNameZh() : e.getNameEn();
        return new StoreItemDto(
                e.getId(), "EXPRESSION", name, e.getCategory(),
                e.getPreviewUrl() == null ? "" : e.getPreviewUrl(),
                null,
                e.getPriceCredits(),
                e.getSaleStatus() == null ? "FREE" : e.getSaleStatus().name(),
                owned
        );
    }

    public static StoreItemDto ofGesture(com.aistareco.model.Gesture g, boolean owned) {
        String name = g.getNameZh() != null && !g.getNameZh().isBlank() ? g.getNameZh() : g.getNameEn();
        return new StoreItemDto(
                g.getId(), "GESTURE", name, g.getCategory(),
                g.getPreviewUrl() == null ? "" : g.getPreviewUrl(),
                null,
                g.getPriceCredits(),
                g.getSaleStatus() == null ? "FREE" : g.getSaleStatus().name(),
                owned
        );
    }
}
