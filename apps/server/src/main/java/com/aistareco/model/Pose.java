package com.aistareco.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "poses")
public class Pose {

    @Id private String id;
    private String nameZh;
    private String nameEn;
    private String category;
    private String thumbnail;
    private String difficulty;
    private boolean locked;
    private boolean newItem;

    private int priceCredits;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private WardrobeItem.SaleStatus saleStatus;

    private String previewUrl;
}
