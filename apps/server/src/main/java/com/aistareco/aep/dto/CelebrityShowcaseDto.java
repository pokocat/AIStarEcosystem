package com.aistareco.aep.dto;

import com.aistareco.aep.model.CelebrityShowcase;

/**
 * Frontend mirror: apps/web/src/types/celebrity-zone.ts {@code CelebrityShowcase}.
 * mode 字段不返回前端（仅后端归档用），通过 query 过滤呈现。
 */
public record CelebrityShowcaseDto(
        String id,
        String caption,
        String engine,
        String plays,
        String approval,
        String thumb,
        String videoUrl
) {
    public static CelebrityShowcaseDto from(CelebrityShowcase s) {
        return new CelebrityShowcaseDto(
                s.getId(), s.getCaption(), s.getEngine(), s.getPlays(),
                s.getApproval(), s.getThumb(), s.getVideoUrl()
        );
    }
}
