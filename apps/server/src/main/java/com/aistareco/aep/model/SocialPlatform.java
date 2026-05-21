package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 第三方社交平台 (sau 集成)。
 *
 * v1 启用 4 个平台 (DOUYIN / KUAISHOU / XIAOHONGSHU / SHIPINHAO)，
 * 全部已在 sau-service 端 wire 完成 (login_pool DRIVERS + uploader._upload_*),
 * 可端到端完成扫码绑定 → 视频派发 → 状态回调。
 *
 * 其余 enum (BILIBILI / TIKTOK / YOUTUBE / BAIJIAHAO) 保留占位，
 * enabledInV1()=false; PublishJobService 会前置拒绝派单 (BUSINESS_ERROR)。
 *
 * SMS 二次验证：仅 DOUYIN 接入了真实 selector，其余三家用 sau-service
 * `_PlaceholderSmsDriver` 占位；触发风控时任务会卡住直至 AWAIT_USER_TIMEOUT，
 * 需 operator 用 SAU_SMS_CAPTURE=1 抓取真实 DOM 后单点升级。
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
