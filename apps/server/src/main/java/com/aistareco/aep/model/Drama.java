package com.aistareco.aep.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aep_dramas")
public class Drama {

    @Id
    private String id;

    @Column(nullable = false)
    private String title;

    private String genre;
    private int episodes;
    private String role;

    @Enumerated(EnumType.STRING)
    private DramaStatus status;

    private long views;
    private long revenue;
    private double rating;
    private Instant releaseDate;

    public enum DramaStatus {
        CASTING("casting"),
        FILMING("filming"),
        POST_PRODUCTION("post-production"),
        RELEASED("released");

        private final String wire;

        DramaStatus(String wire) { this.wire = wire; }

        public String getWire() { return wire; }
    }
}
