package com.aistareco.aep.dto;

import com.aistareco.aep.model.WorkshopScriptVersion;

/** 镜像 packages/types/src/script.ts 的 ScriptVersion。createdAt 为 ISO 字符串。 */
public record ScriptVersionDto(
        String id,
        String scriptId,
        int version,
        String content,
        String authorName,
        boolean aiAssisted,
        String createdAt,
        String note
) {
    public static ScriptVersionDto from(WorkshopScriptVersion v) {
        return new ScriptVersionDto(
                v.getId(),
                v.getScriptId(),
                v.getVersion(),
                v.getContent(),
                v.getAuthorName(),
                v.isAiAssisted(),
                v.getCreatedAt() == null ? null : v.getCreatedAt().toString(),
                v.getNote()
        );
    }
}
