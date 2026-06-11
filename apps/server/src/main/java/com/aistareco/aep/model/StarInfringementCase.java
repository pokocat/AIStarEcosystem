package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

/**
 * 侵权巡查案例（v0.60 web-star）。
 * 全网监测仿冒账号 / 盗用素材 / 非授权数字人；
 * 状态机：pending → investigating → confirmed → resolved（dismiss = 误报直接 resolved）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_infringement_cases")
public class StarInfringementCase {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    /** 全网平台（YouTube / Bilibili / 抖音 / 微博…），非受限枚举。 */
    @Column(nullable = false, length = 64)
    private String platform;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(nullable = false, length = 128)
    private String ipName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    @Column(nullable = false, length = 64)
    private String reportedBy;

    @Column(nullable = false)
    private OffsetDateTime reportedAt;

    @Column(nullable = false, length = 1024)
    private String description;

    @Column(length = 512)
    private String actionNote;

    public enum Severity {
        HIGH("high"),
        MEDIUM("medium"),
        LOW("low");

        private final String wire;
        Severity(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Severity fromWire(String w) {
            for (Severity s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarInfringementCase.Severity: " + w);
        }
    }

    public enum Status {
        PENDING("pending"),
        INVESTIGATING("investigating"),
        CONFIRMED("confirmed"),
        RESOLVED("resolved");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarInfringementCase.Status: " + w);
        }
    }
}
