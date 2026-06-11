package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 数字人授权申请（v0.60 web-star）。
 * MCN 申请使用明星数字人形象：用途三选（live / shortVideo / ads）+ 平台白名单 + 时长。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_digital_human_requests")
public class StarDigitalHumanRequest {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false)
    private String mcnName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private UsageType usageType;

    @Column(name = "platforms_json", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    @Column(nullable = false, length = 512)
    private String purpose;

    @Column(nullable = false)
    @Builder.Default
    private int durationMonths = 0;

    @Column(nullable = false)
    private OffsetDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private StarReviewStatus status;

    @Column(length = 512)
    private String riskNote;

    public enum UsageType {
        LIVE("live"),
        SHORT_VIDEO("shortVideo"),
        ADS("ads");

        private final String wire;
        UsageType(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static UsageType fromWire(String w) {
            for (UsageType t : values()) if (t.wire.equals(w)) return t;
            throw new IllegalArgumentException("unknown StarDigitalHumanRequest.UsageType: " + w);
        }
    }
}
