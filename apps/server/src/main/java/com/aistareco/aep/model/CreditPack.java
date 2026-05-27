package com.aistareco.aep.model;

import com.aistareco.common.StringListConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_credit_packs")
public class CreditPack {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CreditPackTier code;

    @Column(nullable = false)
    private String name;

    private long credits;

    private long priceCents;

    @Column(columnDefinition = "LONGTEXT")
    @Convert(converter = StringListConverter.class)
    private List<String> highlights;

    private Boolean recommended;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CreditPackStatus status;

    public enum CreditPackTier {
        STARTER, STANDARD, PRO, ENTERPRISE
    }

    public enum CreditPackStatus {
        ACTIVE, ARCHIVED
    }
}
