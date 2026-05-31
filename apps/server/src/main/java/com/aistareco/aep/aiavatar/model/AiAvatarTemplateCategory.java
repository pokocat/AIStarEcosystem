package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * AI 模板分类（任务书 §7 模板美化&标准出图 / AI 模板中心）。
 */
public enum AiAvatarTemplateCategory {
    BEAUTY,        // 美颜模板（GFPGAN + 调色 + 妆容迁移）
    STYLE,         // 风格模板（整体视觉风格）
    RETOUCH,       // 质感修复 / 调色
    COMPOSITION;   // 标准构图（正面半身/全身/侧脸…）

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case BEAUTY -> "美颜";
            case STYLE -> "风格";
            case RETOUCH -> "质感修复";
            case COMPOSITION -> "标准构图";
        };
    }

    @JsonCreator
    public static AiAvatarTemplateCategory fromWire(String w) {
        if (w == null) return BEAUTY;
        try {
            return AiAvatarTemplateCategory.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return BEAUTY;
        }
    }
}
