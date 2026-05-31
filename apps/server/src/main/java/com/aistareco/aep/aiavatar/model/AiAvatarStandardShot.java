package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 标准输出物构图（任务书 §3 强制规范）：
 * 2D 标准图集固定 4 张（正面半身 / 正面全身 / 左侧脸 / 右侧脸）+ 表情图。
 */
public enum AiAvatarStandardShot {
    FRONT_BUST,     // 正面半身
    FRONT_FULL,     // 正面全身
    LEFT_PROFILE,   // 左侧脸
    RIGHT_PROFILE,  // 右侧脸
    EXPRESSION;     // 表情图

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case FRONT_BUST -> "正面半身";
            case FRONT_FULL -> "正面全身";
            case LEFT_PROFILE -> "左侧脸";
            case RIGHT_PROFILE -> "右侧脸";
            case EXPRESSION -> "表情图";
        };
    }

    @JsonCreator
    public static AiAvatarStandardShot fromWire(String w) {
        if (w == null) return FRONT_BUST;
        try {
            return AiAvatarStandardShot.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return FRONT_BUST;
        }
    }
}
