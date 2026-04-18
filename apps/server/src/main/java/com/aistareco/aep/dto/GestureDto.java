package com.aistareco.aep.dto;

import com.aistareco.model.Gesture;

public record GestureDto(
        String id,
        String name,
        String icon,
        String category
) {
    public static GestureDto from(Gesture g) {
        String name = g.getNameZh() != null && !g.getNameZh().isBlank()
                ? g.getNameZh() : g.getNameEn();
        return new GestureDto(g.getId(), name, g.getIcon(), g.getCategory());
    }
}
