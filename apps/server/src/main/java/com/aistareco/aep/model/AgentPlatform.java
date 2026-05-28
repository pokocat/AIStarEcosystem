package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Agent 平台类型（v0.39 新增）。
 * 本期仅实现 COZE；DIFY / CUSTOM 预留枚举位，接入时各写一个 driver。
 */
public enum AgentPlatform {
    COZE("coze"),
    DIFY("dify"),
    CUSTOM("custom");

    private final String wire;

    AgentPlatform(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static AgentPlatform fromWire(String w) {
        if (w == null) return COZE;
        for (AgentPlatform p : values()) {
            if (p.wire.equalsIgnoreCase(w)) return p;
        }
        try {
            return AgentPlatform.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return CUSTOM;
        }
    }
}
