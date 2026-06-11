package com.aistareco.aep.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * 合同中心条目（v0.60 web-star）。
 * 三类：授权合同 / 补充协议 / 结算单；状态：active / expired / pending / terminated。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "star_contracts")
public class StarContract {

    @Id
    private String id;

    @Column(name = "star_id", nullable = false)
    private String starId;

    @Column(nullable = false, length = 256)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ContractType type;

    @Column(nullable = false)
    private String mcnName;

    @Column(nullable = false, length = 128)
    private String ipName;

    @Column(nullable = false)
    private LocalDate signDate;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    /** 合同金额（分）。 */
    @Column(nullable = false)
    @Builder.Default
    private long amountCents = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Status status;

    public enum ContractType {
        AUTHORIZATION("authorization"),
        AMENDMENT("amendment"),
        SETTLEMENT("settlement");

        private final String wire;
        ContractType(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static ContractType fromWire(String w) {
            for (ContractType t : values()) if (t.wire.equals(w)) return t;
            throw new IllegalArgumentException("unknown StarContract.ContractType: " + w);
        }
    }

    public enum Status {
        ACTIVE("active"),
        EXPIRED("expired"),
        PENDING("pending"),
        TERMINATED("terminated");

        private final String wire;
        Status(String wire) { this.wire = wire; }
        @JsonValue public String wire() { return wire; }
        @JsonCreator public static Status fromWire(String w) {
            for (Status s : values()) if (s.wire.equals(w)) return s;
            throw new IllegalArgumentException("unknown StarContract.Status: " + w);
        }
    }
}
