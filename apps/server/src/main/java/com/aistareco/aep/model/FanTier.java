package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_fan_tiers")
public class FanTier {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    private String icon;

    private int count;

    private String color;

    private String bg;
}
