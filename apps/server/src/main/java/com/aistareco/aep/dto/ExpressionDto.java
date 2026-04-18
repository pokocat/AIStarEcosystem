package com.aistareco.aep.dto;

import com.aistareco.model.Expression;

public record ExpressionDto(
        String id,
        String name,
        String emoji,
        int intensity,
        String category
) {
    public static ExpressionDto from(Expression e) {
        String name = e.getNameZh() != null && !e.getNameZh().isBlank()
                ? e.getNameZh() : e.getNameEn();
        return new ExpressionDto(
                e.getId(), name, e.getEmoji(), e.getIntensity(), e.getCategory()
        );
    }
}
