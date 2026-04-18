package com.aistareco.aep.dto;

import com.aistareco.model.Pose;

public record PoseDto(
        String id,
        String name,
        String category,
        String thumbnail,
        String difficulty,
        boolean isLocked,
        boolean isNew
) {
    public static PoseDto from(Pose p) {
        String name = p.getNameZh() != null && !p.getNameZh().isBlank()
                ? p.getNameZh() : p.getNameEn();
        return new PoseDto(
                p.getId(), name, p.getCategory(), p.getThumbnail(),
                p.getDifficulty(), p.isLocked(), p.isNewItem()
        );
    }
}
