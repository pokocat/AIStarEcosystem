package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 账号报白申请（v0.60 web-star）。
 * MCN 提交切片账号 → 明星端按 5 步推进：received → contacting → sms → processing → authorized。
 * 数值字段存原始整数（fans / avgViews / accountAgeMonths），格式化在前端展示层。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_whitelist_requests")
public class StarWhitelistRequest {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false)
    private String mcnName;

    @Column(nullable = false)
    private String accountHandle;

    @Column(nullable = false)
    private String accountId;

    /** 已脱敏手机号，如 138****8812。 */
    @Column(nullable = false)
    private String phone;

    @Column(nullable = false)
    private String uid;

    /** 平台中文名：抖音 / 视频号 / 快手 / 小红书。 */
    @Column(nullable = false, length = 32)
    private String platform;

    @Column(nullable = false)
    @Builder.Default
    private long fans = 0;

    @Column(nullable = false)
    @Builder.Default
    private int accountAgeMonths = 0;

    @Column(nullable = false, length = 32)
    private String mcnLevel;

    @Column(nullable = false)
    private OffsetDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Step whitelistStep;

    @Column(length = 512)
    private String message;

    @Column(nullable = false)
    @Builder.Default
    private int recentVideos = 0;

    @Column(nullable = false)
    @Builder.Default
    private long avgViews = 0;

    /** 信用分 0-100；建议 <60 进入 info_required。 */
    @Column(nullable = false)
    @Builder.Default
    private int creditScore = 0;

    public enum Status {
        PENDING("pending"),
        APPROVED("approved"),
        REJECTED("rejected"),
        INFO_REQUIRED("info_required");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarWhitelistRequest.Status: " + w);
        }
    }

    public enum Step {
        RECEIVED("received"),
        CONTACTING("contacting"),
        SMS("sms"),
        PROCESSING("processing"),
        AUTHORIZED("authorized");

        private final String wire;
        Step(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Step fromWire(String w) {
            for (Step s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarWhitelistRequest.Step: " + w);
        }

        public Step next() {
            Step[] all = values();
            return all[Math.min(ordinal() + 1, all.length - 1)];
        }
    }
}
