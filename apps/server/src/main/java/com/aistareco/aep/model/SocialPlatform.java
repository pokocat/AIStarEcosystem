package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 第三方社交平台 (sau 集成)。
 *
 * v1 仅启用前 4 个 (DOUYIN / KUAISHOU / XIAOHONGSHU / SHIPINHAO)；
 * 其余 enum 保留占位，service 调用时抛 NOT_IMPLEMENTED。
 *
 * wire = lowercase，与 packages/types/src/social-account.ts SocialPlatform 对齐。
 */
public enum SocialPlatform {
    DOUYIN("douyin"),
    KUAISHOU("kuaishou"),
    XIAOHONGSHU("xiaohongshu"),
    SHIPINHAO("shipinhao"),
    BILIBILI("bilibili"),
    TIKTOK("tiktok"),
    YOUTUBE("youtube"),
    BAIJIAHAO("baijiahao");

    private final String wire;

    SocialPlatform(String wire) { this.wire = wire; }

    @JsonValue
    public String wire() { return wire; }

    @JsonCreator
    public static SocialPlatform fromWire(String w) {
        if (w == null) return null;
        for (SocialPlatform p : values()) if (p.wire.equals(w)) return p;
        try { return SocialPlatform.valueOf(w.toUpperCase()); } catch (Exception e) { return null; }
    }

    /** v1 是否已实现该平台的 Playwright 上传逻辑 (sau-service 端) */
    public boolean enabledInV1() {
        return this == DOUYIN || this == KUAISHOU || this == XIAOHONGSHU || this == SHIPINHAO;
    }
}
