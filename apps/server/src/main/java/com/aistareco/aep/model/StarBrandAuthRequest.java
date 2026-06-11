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
 * 品牌授权申请（v0.60 web-star）。
 * 状态机：pending → platformReview → celebReview → sampleStage → approved（↘ rejected）。
 * 沿用与商品入库相同的双向寄样校验：双路 approved 才能授权激活。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_brand_auth_requests")
public class StarBrandAuthRequest {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false)
    private String brandName;

    /** 授权类型多选：人像授权 / 代言授权 / 联名授权 / AI声音授权 / 影视植入… */
    @Column(name = "auth_types_json", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> authTypes = new ArrayList<>();

    @Column(nullable = false, length = 512)
    private String purpose;

    @Column(nullable = false)
    @Builder.Default
    private int durationMonths = 0;

    /** 合同金额（分）。 */
    @Column(nullable = false)
    @Builder.Default
    private long amountCents = 0;

    @Column(name = "platforms_json", columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    @Builder.Default
    private List<String> platforms = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

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

    @Column(length = 512)
    private String platformNote;

    public enum Status {
        PENDING("pending"),
        PLATFORM_REVIEW("platformReview"),
        CELEB_REVIEW("celebReview"),
        SAMPLE_STAGE("sampleStage"),
        APPROVED("approved"),
        REJECTED("rejected");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarBrandAuthRequest.Status: " + w);
        }
    }
}
