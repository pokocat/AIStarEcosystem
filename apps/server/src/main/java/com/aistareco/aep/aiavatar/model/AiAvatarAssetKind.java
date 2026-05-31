package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 资产文件类别（任务书 §3 Asset）。
 */
public enum AiAvatarAssetKind {
    IMAGE_2D,           // 标准 2D 图（正面半身/全身/左右侧脸等）
    EXPRESSION_IMAGE,   // 表情图
    MODEL_3D,           // 3D 模型（GLB/FBX）
    VIDEO,              // 衍生短视频
    SOURCE_PHOTO,       // 真人原始照片（加密存储）
    REFERENCE_IMAGE,    // 风格 / 妆容 / 发型参考图
    MASK,               // 分割 / 重绘 mask
    DRAFT_IMAGE;        // 打样 / 草稿迭代过程图

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case IMAGE_2D -> "标准图";
            case EXPRESSION_IMAGE -> "表情图";
            case MODEL_3D -> "3D 模型";
            case VIDEO -> "短视频";
            case SOURCE_PHOTO -> "原始照片";
            case REFERENCE_IMAGE -> "参考图";
            case MASK -> "蒙版";
            case DRAFT_IMAGE -> "草稿图";
        };
    }

    /** 是否敏感（需加密存储）。 */
    public boolean isSensitive() {
        return this == SOURCE_PHOTO;
    }

    @JsonCreator
    public static AiAvatarAssetKind fromWire(String w) {
        if (w == null) return IMAGE_2D;
        try {
            return AiAvatarAssetKind.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return IMAGE_2D;
        }
    }
}
