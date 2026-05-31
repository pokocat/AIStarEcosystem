package com.aistareco.aep.dto;

import com.aistareco.aep.model.WorkshopScript;

/** 镜像 packages/types/src/script.ts 的 Script。时间字段为 ISO 字符串。 */
public record ScriptDto(
        String id,
        String title,
        String kind,
        String status,
        String series,
        String episode,
        String dramaId,
        String currentVersionId,
        int progress,
        String suggestion,
        String createdAt,
        String updatedAt,
        String authorName
) {
    public static ScriptDto from(WorkshopScript s) {
        return new ScriptDto(
                s.getId(),
                s.getTitle(),
                s.getKind(),
                s.getStatus(),
                s.getSeries(),
                s.getEpisode(),
                s.getDramaId(),
                s.getCurrentVersionId(),
                s.getProgress(),
                s.getSuggestion(),
                s.getCreatedAt() == null ? null : s.getCreatedAt().toString(),
                s.getUpdatedAt() == null ? null : s.getUpdatedAt().toString(),
                s.getAuthorName()
        );
    }
}
