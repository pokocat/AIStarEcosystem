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
 * AI 形象授权申请（v0.60 web-star）。
 * 模型粒度三选（voice / face / fullBody）+ 风险三级（low 自动通过仅记录 /
 * medium 经纪团队人工审 / high 明星本人确认 + 合同补签）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_ai_likeness_requests")
public class StarAiLikenessRequest {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false)
    private String mcnName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ModelType modelType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RiskLevel riskLevel;

    @Column(name = "platforms_json", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    @Column(nullable = false, length = 512)
    private String purpose;

    @Column(nullable = false)
    private OffsetDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private StarReviewStatus status;

    @Column(nullable = false)
    private String aiVendor;

    public enum ModelType {
        VOICE("voice"),
        FACE("face"),
        FULL_BODY("fullBody");

        private final String wire;
        ModelType(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static ModelType fromWire(String w) {
            for (ModelType t : values()) if (t.wire.equals(w)) return t;
            throw new IllegalArgumentException("unknown StarAiLikenessRequest.ModelType: " + w);
        }
    }

    public enum RiskLevel {
        LOW("low"),
        MEDIUM("medium"),
        HIGH("high");

        private final String wire;
        RiskLevel(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static RiskLevel fromWire(String w) {
            for (RiskLevel l : values()) if (l.wire.equals(w)) return l;
            throw new IllegalArgumentException("unknown StarAiLikenessRequest.RiskLevel: " + w);
        }
    }
}
