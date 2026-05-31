package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Provider 实现来源（任务书 §5/§6）。
 *
 * <ul>
 *   <li>{@link #MOCK} 纯 Java 占位实现（返回示意资产 + 模拟进度/延迟），可离线整跑</li>
 *   <li>{@link #BACKEND} 走平台大模型网关（AiModelInvocationService）</li>
 *   <li>{@link #SELFHOST} 走自部署模型微服务（HTTP，如 InstantID/SDXL/SAM/TripoSR/SVD）</li>
 * </ul>
 */
public enum AiAvatarProviderMode {
    MOCK,
    BACKEND,
    SELFHOST;

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    @JsonCreator
    public static AiAvatarProviderMode fromWire(String w) {
        if (w == null) return MOCK;
        try {
            return AiAvatarProviderMode.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return MOCK;
        }
    }
}
