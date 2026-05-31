package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 标准输出物构图：
 * 新流程固定 6 镜头，用于前期人设/环境定好后的数字人一致性基准图。
 * 旧 4 视图 + 表情图保留为兼容历史资产。
 */
public enum AiAvatarStandardShot {
    FULL_BODY,      // 全景远景全身
    HALF_BODY,      // 半身中景
    BUST_CLOSEUP,   // 胸像近景
    DETAIL_CLOSEUP, // 细节特写
    THREE_QUARTER_PROFILE, // 45°侧颜
    OVERHEAD,       // 俯拍视角
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
            case FULL_BODY -> "全景远景全身";
            case HALF_BODY -> "半身中景";
            case BUST_CLOSEUP -> "胸像近景";
            case DETAIL_CLOSEUP -> "细节特写";
            case THREE_QUARTER_PROFILE -> "45°侧颜";
            case OVERHEAD -> "俯拍视角";
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
        String normalized = w.trim().toUpperCase().replace('-', '_');
        if ("45_PROFILE".equals(normalized) || "FORTY_FIVE_PROFILE".equals(normalized)) {
            return THREE_QUARTER_PROFILE;
        }
        try {
            return AiAvatarStandardShot.valueOf(normalized);
        } catch (Exception e) {
            return FRONT_BUST;
        }
    }

    /** 数字人一致性生成默认 6 镜头（基于用户提供的通用 6 镜头模板）。 */
    public static java.util.List<AiAvatarStandardShot> standardSix() {
        return java.util.List.of(FULL_BODY, HALF_BODY, BUST_CLOSEUP, DETAIL_CLOSEUP, THREE_QUARTER_PROFILE, OVERHEAD);
    }
}
