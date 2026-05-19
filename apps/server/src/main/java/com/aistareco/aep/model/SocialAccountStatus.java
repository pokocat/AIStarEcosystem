package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 社交账号绑定状态。
 *
 *   PENDING  - 已发起绑定但尚未完成扫码
 *   ACTIVE   - cookie 有效，可用作 PublishJob 源
 *   EXPIRED  - cookie 失效需重新绑定
 *   BANNED   - 平台已封禁此账号 (管理员标记)
 *
 * wire = lowercase，对齐 packages/types/src/social-account.ts。
 */
public enum SocialAccountStatus {
    PENDING("pending"),
    ACTIVE("active"),
    EXPIRED("expired"),
    BANNED("banned");

    private final String wire;

    SocialAccountStatus(String wire) { this.wire = wire; }

    @JsonValue
    public String wire() { return wire; }

    @JsonCreator
    public static SocialAccountStatus fromWire(String w) {
        if (w == null) return null;
        for (SocialAccountStatus s : values()) if (s.wire.equals(w)) return s;
        try { return SocialAccountStatus.valueOf(w.toUpperCase()); } catch (Exception e) { return null; }
    }
}
