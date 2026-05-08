package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TemplateScript 双模选择。wire lower-cased（与 TS 真源 TemplateScriptKind 对齐）。
 *
 *   text:      结构化分镜 + 提示词集合
 *   video_ref: 上传参考视频，由模型按风格 / 结构 / 节奏 / 全部参考生成
 */
public enum TemplateScriptKind {
    TEXT("text"),
    VIDEO_REF("video_ref");

    private final String wire;

    TemplateScriptKind(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static TemplateScriptKind fromWire(String w) {
        if (w == null) return TEXT;
        for (TemplateScriptKind k : values()) {
            if (k.wire.equals(w)) return k;
        }
        try {
            return TemplateScriptKind.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return TEXT;
        }
    }
}
