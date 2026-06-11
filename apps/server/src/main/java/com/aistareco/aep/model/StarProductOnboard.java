package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 商品入库单（v0.60 web-star）。
 *
 * 6 步流程：0=已提交 1=平台初审 2=明星审核 3=样品寄送 4=样品确认 5=已入库 6=已驳回。
 * 双重寄样（平台路 + 明星路）均 approved 才允许 step=5 入库；step=5 的行即「商品库」条目。
 *
 * 打通：source=creator 且 productId 非空 = web-celebrity 创作者从公共商品池「报备」
 * 而来（productId → products 表外键，submittedByUserId 标记报备人，供 celebrity 端回查状态）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_product_onboards")
public class StarProductOnboard {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    /** celebrity 公共商品池外键（creator 报备时必填，其余来源可空）。 */
    @Column(name = "product_id")
    private String productId;

    /** 报备人 userId（celebrity 端回查报备状态用；非报备来源可空）。 */
    @Column(name = "submitted_by_user_id")
    private String submittedByUserId;

    @Column(nullable = false, length = 256)
    private String productName;

    @Column(nullable = false)
    @Builder.Default
    private String brand = "";

    @Column(nullable = false, length = 64)
    private String category;

    @Column(nullable = false)
    @Builder.Default
    private int priceCents = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Source source;

    @Column(nullable = false)
    private String submittedBy;

    private String mcnName;

    /** 0..6，见类注释。 */
    @Column(nullable = false)
    @Builder.Default
    private int step = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private StarSampleStatus platformSample = StarSampleStatus.NOT_SENT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @Builder.Default
    private StarSampleStatus celebSample = StarSampleStatus.NOT_SENT;

    @Column(nullable = false)
    private OffsetDateTime submittedAt;

    private String trackingPlatform;
    private String trackingCeleb;

    @Column(length = 512)
    private String platformNote;

    /** step=5 入库日期（商品库 approvedAt）。 */
    private LocalDate libraryAt;

    /** 入库后累计销量（商品库展示）。 */
    @Column(nullable = false)
    @Builder.Default
    private int salesCount = 0;

    public enum Source {
        PLATFORM("platform"),
        CREATOR("creator"),
        BRAND("brand");

        private final String wire;
        Source(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Source fromWire(String w) {
            for (Source s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarProductOnboard.Source: " + w);
        }
    }
}
