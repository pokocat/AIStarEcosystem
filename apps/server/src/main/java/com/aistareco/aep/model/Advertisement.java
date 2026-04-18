package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_advertisements")
public class Advertisement {

    @Id
    private String id;

    @Column(nullable = false)
    private String brand;

    private String product;

    @Enumerated(EnumType.STRING)
    private AdType type;

    /** Duration in seconds. */
    private int duration;

    @Enumerated(EnumType.STRING)
    private AdStatus status;

    private long payment;
    private long views;

    public enum AdType {
        TVC, DIGITAL, PRINT, SOCIAL
    }

    public enum AdStatus {
        NEGOTIATING, SHOOTING, COMPLETED
    }
}
