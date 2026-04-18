package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "expressions")
public class Expression {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String emoji;
    private int intensity;
    private String category;

    private int priceCredits;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private WardrobeItem.SaleStatus saleStatus;

    private String previewUrl;
}
