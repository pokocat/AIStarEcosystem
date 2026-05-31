package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 精调操作类别（任务书 §7 精调工作台 RefineEdit）。
 *
 * <ul>
 *   <li>{@link #GEOMETRY} 几何微调（瘦脸/眼睛/鼻梁/脸型/嘴型）—— MediaPipe 关键点 + 液化形变（确定性，前端实时）</li>
 *   <li>{@link #APPEARANCE} 外观编辑（妆容/发型/肤质/服饰）—— 迁移 / SD inpainting，异步任务</li>
 *   <li>{@link #NL_GLOBAL} 自然语言整体微调 —— img2img + LLM 指令解析</li>
 *   <li>{@link #REGION} 局部框选重绘 —— SAM mask + inpaint</li>
 * </ul>
 */
public enum AiAvatarRefineKind {
    GEOMETRY,
    APPEARANCE,
    NL_GLOBAL,
    REGION;

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case GEOMETRY -> "几何微调";
            case APPEARANCE -> "外观编辑";
            case NL_GLOBAL -> "自然语言微调";
            case REGION -> "局部重绘";
        };
    }

    @JsonCreator
    public static AiAvatarRefineKind fromWire(String w) {
        if (w == null) return GEOMETRY;
        try {
            return AiAvatarRefineKind.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return GEOMETRY;
        }
    }
}
