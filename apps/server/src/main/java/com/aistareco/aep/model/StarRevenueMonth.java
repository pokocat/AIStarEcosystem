package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

/**
 * 分成收益 · 月度结算行（v0.60 web-star）。
 * 金额一律存「分」；结算周期 T+1 月 15 日打款。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(
    name = "star_revenue_months",
    uniqueConstraints = @UniqueConstraint(columnNames = {"star_id", "rev_month"})
)
public class StarRevenueMonth {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    /** "YYYY-MM"（列名避开 H2 保留字 MONTH）。 */
    @Column(name = "rev_month", nullable = false, length = 8)
    private String month;

    @Column(nullable = false)
    @Builder.Default
    private long gmvCents = 0;

    /** 分成比例（0-100 整数）。 */
    @Column(nullable = false)
    @Builder.Default
    private int sharePercent = 0;

    /** 应得分成（分）。 */
    @Column(nullable = false)
    @Builder.Default
    private long amountCents = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    public enum Status {
        PROCESSING("processing"),
        PAID("paid");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarRevenueMonth.Status: " + w);
        }
    }
}
