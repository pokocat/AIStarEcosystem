package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 4 态授权流转：从未授权 / 待审核 / 已授权 / 已过期。
 * 前端真值源：apps/web/src/types/celebrity-zone.ts CelebrityAuthStatus（lowercased on wire）。
 */
public enum CelebrityAuthStatus {
    UNAUTHORIZED("unauthorized"),
    PENDING("pending"),
    AUTHORIZED("authorized"),
    EXPIRED("expired");

    private final String wire;

    CelebrityAuthStatus(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static CelebrityAuthStatus fromWire(String w) {
        if (w == null) return UNAUTHORIZED;
        for (CelebrityAuthStatus s : values()) {
            if (s.wire.equals(w)) return s;
        }
        // 兼容大写 enum 名 + 容错
        try {
            return CelebrityAuthStatus.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return UNAUTHORIZED;
        }
    }
}
