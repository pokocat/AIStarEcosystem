package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * AiAvatar创建模式（任务书 §1 两种创建模式）。
 *
 * <ul>
 *   <li>{@link #REAL_CLONE} 真人授权复刻 —— 多图上传 + 人脸合规 + 电子肖像授权 + InstantID 复刻打样</li>
 *   <li>{@link #AI_ORIGINAL} 纯 AI 原创 —— 人设文案（LLM 解析）+ 可选风格参考图 + SDXL/FLUX 文生图打样</li>
 * </ul>
 */
public enum AiAvatarCreationMode {
    REAL_CLONE,
    AI_ORIGINAL;

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case REAL_CLONE -> "真人授权复刻";
            case AI_ORIGINAL -> "纯 AI 原创";
        };
    }

    @JsonCreator
    public static AiAvatarCreationMode fromWire(String w) {
        if (w == null) return AI_ORIGINAL;
        return switch (w.trim().toLowerCase()) {
            case "real_clone", "real", "clone" -> REAL_CLONE;
            default -> AI_ORIGINAL;
        };
    }
}
