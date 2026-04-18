package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_fan_growth")
public class FanGrowthPoint {

    @Id
    private String id;

    /** Display label, e.g. "1月". Maps to DTO field "date". */
    @Column(nullable = false)
    private String dateLabel;

    private long fans;

    private long active;
}
