package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 寄样状态（商品入库 / 品牌授权双路寄样共用，v0.60 web-star）。 */
public enum StarSampleStatus {
    NOT_SENT("notSent"),
    SHIPPING("shipping"),
    DELIVERED("delivered"),
    APPROVED("approved"),
    REJECTED("rejected");

    private final String wire;
    StarSampleStatus(String wire) { this.wire = wire; }
    @JsonValue public String wire() { return wire; }
    @JsonCreator public static StarSampleStatus fromWire(String w) {
        for (StarSampleStatus s : values()) if (s.wire.equals(w)) return s;
        throw new IllegalArgumentException("unknown StarSampleStatus: " + w);
    }
}
