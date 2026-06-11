package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * IP 授权中心 · 资产（v0.60 web-star）。
 * 4 类资产（人像/切片/数字人/法务文件）× 6 状态机：
 * notStarted → preparing → uploaded → techReceived → volcanoSync → active。
 * active 后下游模块（数字人审核 / AI 形象 / 内容审核）才出现可授权选项。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "star_ip_assets",
    uniqueConstraints = @UniqueConstraint(columnNames = {"star_id", "type"})
)
public class StarIpAsset {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AssetType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private AssetStatus status;

    /** 对接技术公司名称。 */
    @Column(nullable = false)
    private String techCompany;

    /** 火山引擎项目号（techReceived 后回执）。 */
    private String volcanoProjectId;

    @Column(nullable = false)
    @Builder.Default
    private int filesCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private int requiredFiles = 0;

    private LocalDate uploadedAt;
    private LocalDate activatedAt;

    @Column(length = 512)
    private String note;

    public enum AssetType {
        PORTRAIT("portrait"),
        CLIP("clip"),
        DIGITAL_HUMAN("digitalHuman"),
        DOCUMENTS("documents");

        private final String wire;
        AssetType(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static AssetType fromWire(String w) {
            for (AssetType t : values()) if (t.wire.equals(w)) return t;
            throw new IllegalArgumentException("unknown StarIpAsset.AssetType: " + w);
        }
    }

    public enum AssetStatus {
        NOT_STARTED("notStarted"),
        PREPARING("preparing"),
        UPLOADED("uploaded"),
        TECH_RECEIVED("techReceived"),
        VOLCANO_SYNC("volcanoSync"),
        ACTIVE("active");

        private final String wire;
        AssetStatus(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static AssetStatus fromWire(String w) {
            for (AssetStatus s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarIpAsset.AssetStatus: " + w);
        }

        /** 状态机推进顺序（只前进不回退）。 */
        public AssetStatus next() {
            AssetStatus[] all = values();
            int idx = Math.min(ordinal() + 1, all.length - 1);
            return all[idx];
        }
    }
}
