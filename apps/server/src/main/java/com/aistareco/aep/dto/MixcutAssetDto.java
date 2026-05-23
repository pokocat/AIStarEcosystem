package com.aistareco.aep.dto;

import com.aistareco.aep.model.MixcutAsset;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.format.DateTimeFormatter;

/**
 * 前端镜像：apps/web-celebrity/src/components/mixcut-zone/types.ts 加 MixcutAsset 类型。
 * 字段 snake_case 沿用 mixcut 原型；用 @JsonProperty 显式映射。
 *
 * v0.13+: 增加 is_preset / preset_group / preview_url 三个字段，用于扰动贴图池。
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
        @JsonProperty("uploaded_at") String uploadedAt,
        @JsonProperty("is_preset") boolean isPreset,
        @JsonProperty("preset_group") String presetGroup,
        @JsonProperty("preview_url") String previewUrl,
        // v0.21+ 官方明星片段（运营上传，用户只读）
        @JsonProperty("is_official") boolean isOfficial,
        @JsonProperty("official_category") String officialCategory,
        @JsonProperty("related_star_id") String relatedStarId,
        // v0.26+ 商品主线
        @JsonProperty("related_product_id") String relatedProductId,
        @JsonProperty("subkind") String subkind
) {
    public static MixcutAssetDto from(MixcutAsset a) {
        // thumbnail 优先级：明确的 previewUrl > image/sticker 自身 fileUrl > null
        String thumb = a.getPreviewUrl();
        if (thumb == null && ("image".equals(a.getKind()) || "sticker".equals(a.getKind()))) {
            thumb = a.getFileUrl();
        }
        return new MixcutAssetDto(
                a.getId(),
                a.getUserId(),
                a.getKind(),
                a.getName(),
                a.getOriginalName(),
                a.getFileUrl(),
                thumb,
                a.getMimeType(),
                a.getFileSize(),
                a.getDuration(),
                a.getTags(),
                a.getUploadedAt() == null ? null
                        : a.getUploadedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                a.isPreset(),
                a.getPresetGroup(),
                a.getPreviewUrl(),
                a.isOfficial(),
                a.getOfficialCategory(),
                a.getRelatedStarId(),
                a.getRelatedProductId(),
                a.getSubkind()
        );
    }
}
