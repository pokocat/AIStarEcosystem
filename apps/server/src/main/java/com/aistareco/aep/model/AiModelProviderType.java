package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 大模型 provider 类型（v0.5 §D8 新增）。
 *
 * 本期 AiModelInvocationService 仅实现 OPENAI / OPENAI_COMPATIBLE 的 chat 调用；
 * 其他 providerType 保留 enum 与 admin CRUD，调用时抛 UnsupportedProviderException。
 */
public enum AiModelProviderType {
    OPENAI("OPENAI"),
    ANTHROPIC("ANTHROPIC"),
    AZURE_OPENAI("AZURE_OPENAI"),
    MOONSHOT("MOONSHOT"),
    DEEPSEEK("DEEPSEEK"),
    BAIDU("BAIDU"),
    ALIYUN("ALIYUN"),
    TENCENT("TENCENT"),
    VOLCENGINE("VOLCENGINE"),
    OPENAI_COMPATIBLE("OPENAI_COMPATIBLE"),
    CUSTOM("CUSTOM");

    private final String wire;

    AiModelProviderType(String wire) {
        this.wire = wire;
    }

    @JsonValue
    public String wire() {
        return wire;
    }

    @JsonCreator
    public static AiModelProviderType fromWire(String w) {
        if (w == null) return CUSTOM;
        for (AiModelProviderType t : values()) {
            if (t.wire.equals(w)) return t;
        }
        try {
            return AiModelProviderType.valueOf(w.toUpperCase());
        } catch (Exception e) {
            return CUSTOM;
        }
    }
}
