package com.aistareco.aep.aiavatar.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 真人肖像授权状态（任务书 §3 LicenseGrant / §7 真人授权管理）。
 */
public enum AiAvatarLicenseStatus {
    ACTIVE,     // 生效中
    EXPIRED,    // 已过期
    REVOKED;    // 已撤销

    @JsonValue
    public String wire() {
        return name().toLowerCase();
    }

    public String label() {
        return switch (this) {
            case ACTIVE -> "生效中";
            case EXPIRED -> "已过期";
            case REVOKED -> "已撤销";
        };
    }

    @JsonCreator
    public static AiAvatarLicenseStatus fromWire(String w) {
        if (w == null) return ACTIVE;
        try {
            return AiAvatarLicenseStatus.valueOf(w.trim().toUpperCase());
        } catch (Exception e) {
            return ACTIVE;
        }
    }
}
