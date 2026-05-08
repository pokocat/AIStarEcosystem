package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * TemplateScript 生命周期状态。wire lower-cased（与 TS 真源 TemplateScriptStatus 对齐）。
 */
public enum TemplateScriptStatus {
    DRAFT("draft"),
    IN_REVIEW("in_review"),
    PUBLISHED("published"),
    ARCHIVED("archived");

    private final String wire;

    TemplateScriptStatus(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static TemplateScriptStatus fromWire(String w) {
        if (w == null) return DRAFT;
        for (TemplateScriptStatus s : values()) {
            if (s.wire.equals(w)) return s;
        }
        try {
            return TemplateScriptStatus.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return DRAFT;
        }
    }
}
