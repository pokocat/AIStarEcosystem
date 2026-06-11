package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 通用三态审核状态（数字人 / AI 形象授权共用，v0.60 web-star）。 */
public enum StarReviewStatus {
    PENDING("pending"),
    APPROVED("approved"),
    REJECTED("rejected");

    private final String wire;
    StarReviewStatus(String wire) { this.wire = wire; }
    @JsonValue public String wire() { return wire; }
    @JsonCreator public static StarReviewStatus fromWire(String w) {
        for (StarReviewStatus s : values()) if (s.wire.equals(w)) return s;
        throw new IllegalArgumentException("unknown StarReviewStatus: " + w);
    }
}
