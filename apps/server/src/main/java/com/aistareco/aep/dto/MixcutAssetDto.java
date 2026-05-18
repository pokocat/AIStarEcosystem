package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutAsset;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.format.DateTimeFormatter;

/**
 * 前端镜像：apps/web-celebrity/src/components/mixcut-zone/types.ts 加 MixcutAsset 类型。
 * 字段 snake_case 沿用 mixcut 原型；用 @JsonProperty 显式映射。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MixcutAssetDto(
        @JsonProperty("id") String id,
        @JsonProperty("user_id") String userId,
        @JsonProperty("kind") String kind,
        @JsonProperty("name") String name,
        @JsonProperty("original_name") String originalName,
        @JsonProperty("file_url") String fileUrl,
        @JsonProperty("thumbnail_url") String thumbnailUrl,
        @JsonProperty("mime_type") String mimeType,
        @JsonProperty("file_size") long fileSize,
        @JsonProperty("duration") double duration,
        @JsonProperty("tags") String tags,
        @JsonProperty("uploaded_at") String uploadedAt
) {
    public static MixcutAssetDto from(MixcutAsset a) {
        return new MixcutAssetDto(
                a.getId(),
                a.getUserId(),
                a.getKind(),
                a.getName(),
                a.getOriginalName(),
                a.getFileUrl(),
                // MVP 阶段：image / sticker 自身可作缩略图；video / bgm 暂无（v0.10 用 ffmpeg 抽帧）
                ("image".equals(a.getKind()) || "sticker".equals(a.getKind())) ? a.getFileUrl() : null,
                a.getMimeType(),
                a.getFileSize(),
                a.getDuration(),
                a.getTags(),
                a.getUploadedAt() == null ? null
                        : a.getUploadedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        );
    }
}
