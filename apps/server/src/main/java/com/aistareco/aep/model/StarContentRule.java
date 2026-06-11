package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

/**
 * 内容授权规则（v0.60 web-star）。
 * 绿/黄/橙/红四区策略，是报白 / 数字人 / AI 形象 / 内容审核的统一判定来源。
 * 规则改动立即生效（已审项不回溯）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_content_rules")
public class StarContentRule {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false, length = 128)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Zone zone;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(nullable = false, length = 512)
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    public enum Zone {
        GREEN("green"),
        YELLOW("yellow"),
        ORANGE("orange"),
        RED("red");

        private final String wire;
        Zone(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Zone fromWire(String w) {
            for (Zone z : values()) if (z.wire.equals(w)) return z;
            throw new IllegalArgumentException("unknown StarContentRule.Zone: " + w);
        }
    }
}
